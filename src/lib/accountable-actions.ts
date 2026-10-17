/* eslint-disable @typescript-eslint/no-explicit-any */
import {warehouseAssignmentScope, managerWarehouseAccess, managerHasWarehouseAccess} from "@/lib/warehouse-access";
import "server-only";

import { z } from "zod";

import { canAccessFarm, canAccessWarehouse, governanceAdmin, type AccessContext } from "@/lib/access-context";
import type { ActionCard, ActionDesk, ActionEvent, ActionOwner, ActionStatus, OperationalAlert } from "@/lib/action-desk-contract";
import { actionDeadlineAt, actionStatusAfter, actionSourceInScope, isLegacyUnscopedWarning } from "@/lib/action-desk-policy";
import { getCurrentAlerts } from "@/lib/current-alerts";
import { getGovernanceAlerts } from "@/lib/governance-workflow";
import { getReconciliationAlerts, isReconciliationFindingActive } from "@/lib/reconciliation-service";
import { publishActionEventNotifications } from "@/lib/notification-service";
import {allAlertRows, actionReadFilter} from "./alert-pagination.ts";

type Row = Record<string, unknown>;
const db = governanceAdmin as any;
const activeStatuses = ["open", "assigned", "acknowledged", "in_progress", "awaiting_verification", "escalated"];

const commandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("assign"), ownerId: z.string().uuid(), dueAt: z.string().datetime().optional(), instruction: z.string().trim().min(8).max(1000).optional() }),
  z.object({ command: z.literal("claim") }),
  z.object({ command: z.literal("acknowledge"), note: z.string().trim().min(4).max(1000) }),
  z.object({ command: z.literal("start"), note: z.string().trim().min(4).max(1000) }),
  z.object({ command: z.literal("submit_resolution"), note: z.string().trim().min(8).max(2000), evidence: z.string().trim().max(4000).optional() }),
  z.object({ command: z.literal("verify") }),
  z.object({ command: z.literal("retire_legacy"), note: z.string().trim().min(8).max(2000) }),
  z.object({ command: z.literal("set_due"), dueAt: z.string().datetime(), note: z.string().trim().min(4).max(1000) }),
]);

export type ActionCommand = z.infer<typeof commandSchema>;

function text(value: unknown) { return typeof value === "string" ? value : value == null ? "" : String(value); }
function nullable(value: unknown) { const valueText = text(value); return valueText || null; }

export async function collectOperationalAlerts(ctx: AccessContext): Promise<OperationalAlert[]> {
  const [current, reconciliation, governance] = await Promise.all([
    getCurrentAlerts(governanceAdmin, ctx.orgId),
    getReconciliationAlerts(ctx),
    getGovernanceAlerts(ctx),
  ]);
  const unique = new Map<string, OperationalAlert>();
  [...governance, ...reconciliation, ...current].forEach((alert) => unique.set(alert.id, alert));
  return [...unique.values()];
}

async function actor(ctx: AccessContext) {
  const { data } = await db.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
  return { id: ctx.userId, name: text(data?.full_name) || (ctx.role === "ceo" ? "CEO" : ctx.role === "farm_manager" ? "Farm Manager" : "System Administrator"), role: ctx.role };
}

async function event(ctx: AccessContext, actionId: string, eventType: string, before: ActionStatus | null, after: ActionStatus, note?: string | null, evidence?: string | null, automated = false) {
  const who = automated ? { id: null, name: "System", role: "system" } : await actor(ctx);
  const { data: created, error } = await db.from("operational_action_events").insert({
    org_id: ctx.orgId, action_id: actionId, event_type: eventType, actor_id: who.id,
    actor_name_snapshot: who.name, actor_role_snapshot: who.role, note: note ?? null,
    evidence: evidence ?? null, before_status: before, after_status: after,
    support_session_id: ctx.supportSessionId,
  }).select("id,org_id,action_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,created_at").single();
  if (error) throw new Error(`Action history could not be recorded: ${error.message}`);
  const { data: action } = await db.from("operational_actions").select("*,owner:profiles!operational_actions_owner_id_fkey(full_name)").eq("id", actionId).maybeSingle();
  if (action && created) await publishActionEventNotifications({ action, event: created });
}

async function commitAction(ctx: AccessContext, row: Row, changes: Row, eventType: string | null,
  note: string | null = null, evidence: string | null = null, automated = false) {
  const {data, error} = await db.rpc("apply_operational_action_transition", {
    p_actor_id: ctx.userId, p_org_id: ctx.orgId, p_action_id: row.id,
    p_expected_revision: row.revision, p_changes: changes, p_event_type: eventType,
    p_note: note, p_evidence: evidence, p_automated: automated, p_support_session_id: ctx.supportSessionId,
  });
  // A background refresh must never overwrite or fail the user's newer work.
  // The next refresh can re-read the row; human saves receive an explicit conflict.
  if (error?.code === "40001" && automated) return null;
  if (error) throw new Error(error.message);
  if (data.event) await publishActionEventNotifications({action: data.action, event: data.event});
  return data.action;
}

async function scope(ctx: AccessContext) {
  if (ctx.role === "ceo" || ctx.supportSessionId) return { farms: null as Set<string> | null, warehouses: null as Set<string> | null };
  const now = new Date().toISOString();
  const [farms, warehouses] = await Promise.all([
    allAlertRows<Row>((from, to) => db.from("user_farm_access").select("farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).order("id").range(from, to)).then(data => ({data, error: null})),
    warehouseAssignmentScope(ctx),
  ]);
  if (farms.error) throw new Error("Farm assignments could not be checked.");
  return { farms: new Set<string>((farms.data ?? []).map((row: Row) => text(row.farm_id))), warehouses: new Set<string>((warehouses.data ?? []).map((row: Row) => text(row.warehouse_id))) };
}

function visible(row: Row, ids: Awaited<ReturnType<typeof scope>>) {
  return actionSourceInScope({farmId: nullable(row.farm_id), warehouseId: nullable(row.warehouse_id)}, ids);
}

async function exactSourceState(ctx: AccessContext, row: Row) {
  const {data, error} = await db.rpc("operational_action_source_state", {p_org_id: ctx.orgId, p_action_id: row.id});
  if (error) throw new Error("Could not verify the warning source. Refresh and try again.");
  return z.object({state: z.enum(["active", "clear", "unavailable", "superseded"])}).parse(data).state;
}

async function synchronize(ctx: AccessContext, alerts: OperationalAlert[]) {
  const accessible = await scope(ctx);
  alerts = alerts.filter(alert => actionSourceInScope({farmId: alert.farmId ?? null, warehouseId: alert.warehouseId ?? null}, accessible));
  const stored = await allAlertRows<Row>((from, to) => scopedActions(ctx, accessible, "*")
    .in("status", activeStatuses).order("id").range(from, to));
  // Read only resolved keys that are currently reported, not the entire archive.
  for (let offset = 0; offset < alerts.length; offset += 200) {
    const result = await scopedActions(ctx, accessible, "*").eq("status", "resolved")
      .in("source_key", alerts.slice(offset, offset + 200).map(alert => alert.id)).order("id").limit(200);
    if (result.error) throw new Error("Previous alerts could not be checked.");
    stored.push(...result.data ?? []);
  }
  const byKey = new Map<string, Row>(stored.map((row: Row) => [text(row.source_key), row]));
  const now = new Date().toISOString();

  for (const alert of alerts) {
    const prior = byKey.get(alert.id);
    if (!prior) {
      const { data, error: insertError } = await db.from("operational_actions").insert({
        org_id: ctx.orgId, source_key: alert.id, source_name: alert.source, source_route: alert.route,
        title: alert.title, context: alert.context, severity: alert.severity,
        farm_id: alert.farmId ?? null, warehouse_id: alert.warehouseId ?? null,
        due_at: actionDeadlineAt(alert.severity), source_first_seen_at: alert.createdAt, source_last_seen_at: now,
      }).select("*").single();
      if (insertError) {
        if (insertError.code === "23505") continue;
        throw new Error(insertError.message);
      }
      byKey.set(alert.id, data);
      await event(ctx, text(data.id), "discovered", null, "open", "Created from an active deterministic alert.", null, true);
      continue;
    }
    const wasResolved = text(prior.status) === "resolved";
    const changes: Row = {
      source_name: alert.source, source_route: alert.route, title: alert.title, context: alert.context,
      severity: alert.severity, farm_id: alert.farmId ?? prior.farm_id ?? null,
      warehouse_id: alert.warehouseId ?? prior.warehouse_id ?? null, source_last_seen_at: now, source_resolved_at: null, updated_at: now,
    };
    // A refresh should not write every unchanged warning back to PostgreSQL.
    // Source freshness timestamps advance when source content/state changes.
    if (!wasResolved && Object.entries(changes).every(([key, value]) =>
      key === "source_last_seen_at" || key === "updated_at" || value === prior[key])) continue;
    if (wasResolved) Object.assign(changes, { status: prior.owner_id ? "assigned" : "open", due_at: actionDeadlineAt(alert.severity), source_resolved_at: null, resolution_summary: null, resolution_evidence: null, escalated_at: null, escalation_reason: null });
    await commitAction(ctx, prior, changes, wasResolved ? "reopened" : null,
      wasResolved ? "The source system reported this issue again." : null, null, true);
  }

  const activeKeys = new Set(alerts.map((alert) => alert.id));
  for (const row of byKey.values()) {
    if (text(row.status) === "resolved" || activeKeys.has(text(row.source_key)) || !visible(row, accessible)) continue;
    const state = await exactSourceState(ctx, row);
    const baseContext = text(row.context).split(" Source status:", 1)[0];
    if (state !== "clear") {
      const context = state === "superseded" ? `${baseContext} Source status: This older warning was replaced by scoped checks. CEO review is required to retire it.`
        : state === "unavailable" ? `${baseContext} Source status: Could not verify this problem. Its exact source needs review.` : baseContext;
      if (context !== row.context || row.source_resolved_at) await commitAction(ctx, row, {context, source_resolved_at: null}, null, null, null, true);
      continue;
    }
    if (row.source_resolved_at) continue;
    const sourceStatus = text(row.status) === "awaiting_verification"
      ? "Source status: The source check is clear. The CEO can now review and verify this completed task."
      : "Source status: The source check is clear. Confirm completion and send this task to the CEO for review.";
    await commitAction(ctx, row, {context: `${baseContext} ${sourceStatus}`, source_resolved_at: now}, null, null, null, true);
  }

  const overdue = await allAlertRows<Row>((from, to) => scopedActions(ctx, accessible, "*")
    .in("status", ["open", "assigned", "acknowledged", "in_progress"]).lt("due_at", now).order("id").range(from, to));
  for (const row of overdue) {
    await commitAction(ctx, row, {status: "escalated", escalated_at: now,
      escalation_reason: "The action passed its due date without verified resolution."},
      "escalated", "Due date passed without verified resolution.", null, true);
  }
}

async function ownerOptions(ctx: AccessContext): Promise<ActionOwner[]> {
  if (ctx.role !== "ceo") return [];
  const now = new Date().toISOString();
  const people = await allAlertRows<Row>((from, to) => db.from("profiles").select("id,full_name").eq("org_id", ctx.orgId).eq("role", "farm_manager").eq("is_active", true).order("full_name").order("id").range(from, to), 200, 1000);
  const ids = (people ?? []).map((row: Row) => text(row.id));
  if (!ids.length) return [];
  const [farmAccess, warehouseAccess] = await Promise.all([
    allAlertRows<Row>((from, to) => db.from("user_farm_access").select("profile_id,farm_id,farms(name)").eq("org_id", ctx.orgId).in("profile_id", ids).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).order("id").range(from, to)).then(data => ({data})),
    Promise.all(ids.map(async (id: string) => (await managerWarehouseAccess(id, ctx.orgId)).map(row => ({profile_id: id, warehouses: {name: row.name}})))).then(groups => ({data: groups.flat()})),
  ]);
  return (people ?? []).map((person: Row) => {
    const farms = (farmAccess.data ?? []).filter((row: Row) => text(row.profile_id) === text(person.id)).map((row: Row) => text((row.farms as Row | null)?.name)).filter(Boolean);
    const warehouses = (warehouseAccess.data ?? []).filter((row: Row) => text(row.profile_id) === text(person.id)).map((row: Row) => text((row.warehouses as Row | null)?.name)).filter(Boolean);
    return { id: text(person.id), name: text(person.full_name) || "Farm Manager", scope: [...farms, ...warehouses].join(" · ") || "No active operational assignment" };
  });
}

export async function refreshActionDesk(ctx: AccessContext) {
  const alerts = await collectOperationalAlerts(ctx);
  await synchronize(ctx, alerts);
}

function scopedActions(ctx: AccessContext, ids: Awaited<ReturnType<typeof scope>>, selection: string, cursor?: {priority: number; dueAt: string; id: string}) {
  let query = db.from("operational_action_inbox").select(selection, {count: "exact"}).eq("org_id", ctx.orgId);
  const filter = actionReadFilter(ids, cursor);
  if (filter) query = query.or(filter);
  return query;
}

export async function loadActionDesk(ctx: AccessContext, options: {cursor?: string; target?: string; header?: boolean} = {}): Promise<ActionDesk> {
  const ids = await scope(ctx);
  const cursor = options.cursor ? z.object({priority: z.number().int().min(0).max(3), dueAt: z.string().datetime({offset: true}), id: z.string().uuid()}).parse(JSON.parse(options.cursor)) : undefined;
  const pageSize = options.header ? 30 : 50;
  const selection = options.header
    ? "id,inbox_priority,source_key,title,severity,source_name,context,source_route,source_first_seen_at,farm_id,warehouse_id,status,owner_id,due_at,revision,owner:profiles!operational_actions_owner_id_fkey(full_name)"
    : "*,owner:profiles!operational_actions_owner_id_fkey(full_name),operational_action_events(id,event_type,actor_name_snapshot,actor_role_snapshot,note,created_at)";
  let query = scopedActions(ctx, ids, selection, cursor).in("status", activeStatuses).order("inbox_priority").order("due_at").order("id").limit(pageSize + 1);
  if (options.target) query = query.eq("id", z.string().uuid().parse(options.target));
  if (!options.header) query = query.order("created_at", {referencedTable: "operational_action_events", ascending: false})
    .order("id", {referencedTable: "operational_action_events", ascending: false}).limit(8, {referencedTable: "operational_action_events"});
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((row: Row) => visible(row, ids)).slice(0, pageSize);
  const actions: ActionCard[] = rows.map((row: Row) => {
    const owner = row.owner as Row | null;
    const events = ((row.operational_action_events as Row[] | null) ?? []).sort((a, b) => text(b.created_at).localeCompare(text(a.created_at))).slice(0, 8).map((item): ActionEvent => ({ id: text(item.id), eventType: text(item.event_type), actorName: text(item.actor_name_snapshot), actorRole: text(item.actor_role_snapshot), note: nullable(item.note), createdAt: text(item.created_at) }));
    const isOwner = text(row.owner_id) === ctx.userId;
    const unownedInScope = !row.owner_id && visible(row, ids);
    return {
      actionId: text(row.id), id: text(row.source_key), title: text(row.title), severity: text(row.severity) as ActionCard["severity"],
      source: text(row.source_name), context: text(row.context), route: text(row.source_route), createdAt: text(row.source_first_seen_at),
      farmId: nullable(row.farm_id), warehouseId: nullable(row.warehouse_id), status: text(row.status) as ActionStatus,
      ownerId: nullable(row.owner_id), ownerName: nullable(owner?.full_name), revision: String(row.revision),
      canRetireLegacy: ctx.role === "ceo" && isLegacyUnscopedWarning(text(row.source_key), nullable(row.warehouse_id)),
      dueAt: text(row.due_at), acknowledgedAt: nullable(row.acknowledged_at),
      resolutionSummary: nullable(row.resolution_summary), resolutionEvidence: nullable(row.resolution_evidence), escalatedAt: nullable(row.escalated_at),
      canAssign: ctx.role === "ceo" && Boolean(row.farm_id || row.warehouse_id), canClaim: ctx.role === "farm_manager" && unownedInScope, canWork: (ctx.role === "farm_manager" && isOwner) || ctx.role === "ceo", events,
    };
  });
  const soon = Date.now() + 24 * 3600000;
  return {
    role: ctx.role, viewerId: ctx.userId, actions, owners: options.header ? [] : await ownerOptions(ctx),
    page: {total: count ?? rows.length, nextCursor: (data?.length ?? 0) > pageSize && rows.length
      ? JSON.stringify({priority: rows.at(-1)!.inbox_priority, dueAt: text(rows.at(-1)!.due_at), id: text(rows.at(-1)!.id)}) : null},
    summary: {
      unassigned: actions.filter((item) => !item.ownerId).length,
      mine: actions.filter((item) => item.ownerId === ctx.userId).length,
      dueSoon: actions.filter((item) => new Date(item.dueAt).getTime() <= soon).length,
      escalated: actions.filter((item) => item.status === "escalated").length,
      awaitingVerification: actions.filter((item) => item.status === "awaiting_verification").length,
    },
  };
}

export async function ensureReconciliationAction(ctx: AccessContext, findingId: string) {
  if (ctx.role !== "ceo") throw new Error("Only the CEO can assign Record Checks.");
  const { data: finding, error } = await db.from("reconciliation_findings").select("id,status,title,severity,explanation,recommended_action,farm_id,warehouse_id,last_seen_at").eq("id", findingId).eq("org_id", ctx.orgId).maybeSingle();
  if (error || !finding) throw new Error(error?.message ?? "Record Check not found.");
  if (!["open", "acknowledged", "investigating"].includes(text(finding.status))) throw new Error("Only an active Record Check can be assigned.");
  const sourceKey = `reconciliation-${findingId}`;
  const { data: existing } = await db.from("operational_actions").select("*").eq("org_id", ctx.orgId).eq("source_key", sourceKey).maybeSingle();
  if (existing) return existing;
  const severity = ["critical", "high"].includes(text(finding.severity)) ? "high" : text(finding.severity) === "medium" ? "medium" : "low";
  const now = new Date().toISOString();
  const { data, error: insertError } = await db.from("operational_actions").insert({
    org_id: ctx.orgId, source_key: sourceKey, source_name: "Record Checks", source_route: `/app/reconciliation?finding=${findingId}`,
    title: text(finding.title), context: text(finding.recommended_action) || text(finding.explanation), severity,
    farm_id: finding.farm_id ?? null, warehouse_id: finding.warehouse_id ?? null, due_at: actionDeadlineAt(severity),
    source_first_seen_at: text(finding.last_seen_at) || now, source_last_seen_at: now,
  }).select("*").single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await db.from("operational_actions").select("*").eq("org_id", ctx.orgId).eq("source_key", sourceKey).single();
      return raced;
    }
    throw new Error(insertError.message);
  }
  await event(ctx, text(data.id), "discovered", null, "open", "Created when the CEO chose to assign this Record Check.", null, true);
  return data;
}

export async function assignReconciliationFinding(ctx: AccessContext, findingId: string, ownerId: string, dueAt?: string, instruction?: string) {
  const action = await ensureReconciliationAction(ctx, findingId);
  return transitionAction(ctx, text(action.id), { command: "assign", ownerId, ...(dueAt ? { dueAt } : {}), ...(instruction ? { instruction } : {}) });
}

async function assertScope(ctx: AccessContext, row: Row) {
  if (ctx.role === "ceo" || ctx.supportSessionId) return;
  if (row.farm_id && await canAccessFarm(ctx, text(row.farm_id))) return;
  if (row.warehouse_id && await canAccessWarehouse(ctx, text(row.warehouse_id))) return;
  throw new Error("This action is outside your active assignment.");
}

async function assertAssignableOwner(ctx: AccessContext, row: Row, ownerId: string) {
  if (!row.farm_id && !row.warehouse_id) throw new Error("This organization-wide warning has no farm or warehouse target and cannot be assigned to a Farm Manager.");
  const { data: profile } = await db.from("profiles").select("id,role,is_active").eq("id", ownerId).eq("org_id", ctx.orgId).maybeSingle();
  if (!profile || profile.role !== "farm_manager" || !profile.is_active) throw new Error("Choose an active Farm Manager.");
  const now = new Date().toISOString();
  if (row.farm_id) {
    const { data } = await db.from("user_farm_access").select("id").eq("profile_id", ownerId).eq("farm_id", row.farm_id).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
    if (!data) throw new Error("That Farm Manager is not assigned to the affected farm.");
  }
  if (row.warehouse_id) {
    if (!await managerHasWarehouseAccess(ownerId, text(row.warehouse_id))) throw new Error("That Farm Manager has no farm or shared-store access to the affected warehouse.");
  }
}

export async function transitionAction(ctx: AccessContext, actionId: string, input: unknown) {
  const command = commandSchema.parse(input);
  const { data: row, error } = await db.from("operational_actions").select("*").eq("id", actionId).eq("org_id", ctx.orgId).maybeSingle();
  if (error || !row) throw new Error(error?.message ?? "Action not found.");
  await assertScope(ctx, row);
  const expected = z.object({expectedRevision: z.string().regex(/^\d+$/).optional()}).parse(input).expectedRevision;
  if (expected !== undefined && expected !== String(row.revision)) throw new Error("Action changed. Refresh before continuing.");
  const before = text(row.status) as ActionStatus;
  if (before === "resolved") throw new Error("This action has already been verified and resolved.");
  const now = new Date().toISOString();
  let changes: Row = { updated_at: now };
  let eventType: string = command.command;
  let note: string | null = "note" in command ? command.note : null;
  let evidence: string | null = null;

  if (command.command === "assign") {
    if (ctx.role !== "ceo") throw new Error("Only the CEO can assign operational actions.");
    await assertAssignableOwner(ctx, row, command.ownerId);
    changes = { ...changes, owner_id: command.ownerId, assigned_by: ctx.userId, assigned_at: now, due_at: command.dueAt ?? row.due_at, status: actionStatusAfter("assign", before), escalated_at: null, escalation_reason: null };
    eventType = "assigned"; note = command.instruction ?? "Responsibility assigned by the CEO.";
  } else if (command.command === "claim") {
    if (ctx.role !== "farm_manager" || row.owner_id) throw new Error("Only an unassigned in-scope action can be claimed.");
    changes = { ...changes, owner_id: ctx.userId, assigned_by: ctx.userId, assigned_at: now, status: actionStatusAfter("claim", before) };
    eventType = "claimed"; note = "Farm Manager accepted responsibility.";
  } else if (command.command === "set_due") {
    if (ctx.role !== "ceo") throw new Error("Only the CEO can change an action due date.");
    changes = { ...changes, due_at: command.dueAt, status: before === "escalated" ? (row.owner_id ? "assigned" : "open") : before, escalated_at: null, escalation_reason: null };
    eventType = "due_date_changed";
  } else if (command.command === "retire_legacy") {
    if (ctx.role !== "ceo") throw new Error("Only the CEO can retire older warnings.");
    changes = {...changes, status: "resolved"}; eventType = "legacy_retired";
  } else {
    if (ctx.role === "farm_manager" && text(row.owner_id) !== ctx.userId) throw new Error("This action must be assigned to you before you can update it.");
    if (command.command === "acknowledge") {
      changes = {...changes, status: "acknowledged", acknowledged_by: ctx.userId, acknowledged_at: now};
      eventType = "acknowledged";
    }
    if (command.command === "start") { changes = { ...changes, status: actionStatusAfter("start", before) }; eventType = "work_started"; }
    if (command.command === "submit_resolution") {
      changes = { ...changes, status: actionStatusAfter("submit_resolution", before), resolution_summary: command.note, resolution_evidence: command.evidence, resolution_submitted_by: ctx.userId, resolution_submitted_at: now };
      if (row.source_resolved_at) {
        const baseContext = text(row.context).split(" Source status:", 1)[0];
        changes.context = `${baseContext} Source status: The source check is clear. The CEO can now review and verify this completed task.`;
      }
      eventType = "resolution_submitted"; evidence = command.evidence ?? null;
    }
    if (command.command === "verify") {
      if (ctx.role !== "ceo") throw new Error("Only the CEO can verify and close completed actions.");
      if (before !== "awaiting_verification") throw new Error("The Farm Manager must complete and submit this task before CEO verification.");
      const findingId = text(row.source_key).startsWith("reconciliation-") ? text(row.source_key).slice("reconciliation-".length) : null;
      // Refresh Record Checks first. The locked SQL save then checks the exact
      // source again and decides verified/failed; no warning-list membership.
      if (findingId) await isReconciliationFindingActive(ctx, findingId, true);
      changes = {...changes, status: "resolved"}; eventType = "system_verified";
    }
  }
  return commitAction(ctx, row, changes, eventType, note, evidence);
}
