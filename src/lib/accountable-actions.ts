/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { z } from "zod";

import { canAccessFarm, canAccessWarehouse, governanceAdmin, type AccessContext } from "@/lib/access-context";
import type { ActionCard, ActionDesk, ActionEvent, ActionOwner, ActionStatus, OperationalAlert } from "@/lib/action-desk-contract";
import { actionDeadlineAt, actionStatusAfter } from "@/lib/action-desk-policy";
import { recordAuditEvent } from "@/lib/audit-ledger";
import { getCurrentAlerts } from "@/lib/current-alerts";
import { getGovernanceAlerts } from "@/lib/governance-workflow";
import { getReconciliationAlerts, isReconciliationFindingActive } from "@/lib/reconciliation-service";
import { publishActionEventNotifications } from "@/lib/notification-service";

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

async function scope(ctx: AccessContext) {
  if (ctx.role === "ceo" || ctx.supportSessionId) return { farms: null as Set<string> | null, warehouses: null as Set<string> | null };
  const now = new Date().toISOString();
  const [farms, warehouses] = await Promise.all([
    db.from("user_farm_access").select("farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`),
    db.from("user_warehouse_access").select("warehouse_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);
  return { farms: new Set<string>((farms.data ?? []).map((row: Row) => text(row.farm_id))), warehouses: new Set<string>((warehouses.data ?? []).map((row: Row) => text(row.warehouse_id))) };
}

function visible(row: Row, ctx: AccessContext, ids: Awaited<ReturnType<typeof scope>>) {
  if (ids.farms === null) return true;
  if (text(row.owner_id) === ctx.userId) return true;
  const farmId = text(row.farm_id), warehouseId = text(row.warehouse_id);
  return Boolean((farmId && ids.farms.has(farmId)) || (warehouseId && ids.warehouses?.has(warehouseId)));
}

async function inventoryAlertActive(ctx: AccessContext, row: Row): Promise<boolean | null> {
  const sourceKey = text(row.source_key);
  if (text(row.source_name) !== "Inventory" || !sourceKey.startsWith("inv-")) return null;
  const itemId = sourceKey.slice(4);
  const [itemResult, ledgerResult] = await Promise.all([
    db.from("inventory_items").select("reorder_level").eq("id", itemId).eq("org_id", ctx.orgId).maybeSingle(),
    db.from("stock_ledger").select("quantity,transaction_type").eq("item_id", itemId).eq("org_id", ctx.orgId),
  ]);
  if (itemResult.error) throw new Error(itemResult.error.message);
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);
  if (!itemResult.data || itemResult.data.reorder_level == null) return false;
  const balance = (ledgerResult.data ?? []).reduce((sum: number, movement: Row) => {
    const quantity = Number(movement.quantity) || 0;
    return sum + (["issue", "transfer_out"].includes(text(movement.transaction_type)) ? -quantity : quantity);
  }, 0);
  return balance <= Number(itemResult.data.reorder_level);
}

async function synchronize(ctx: AccessContext, alerts: OperationalAlert[]) {
  const { data: stored, error } = await db.from("operational_actions").select("*").eq("org_id", ctx.orgId);
  if (error) throw new Error(error.message);
  const byKey = new Map<string, Row>((stored ?? []).map((row: Row) => [text(row.source_key), row]));
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
    if (wasResolved) Object.assign(changes, { status: prior.owner_id ? "assigned" : "open", due_at: actionDeadlineAt(alert.severity), source_resolved_at: null, resolution_summary: null, resolution_evidence: null, escalated_at: null, escalation_reason: null });
    const { error: updateError } = await db.from("operational_actions").update(changes).eq("id", prior.id);
    if (updateError) throw new Error(updateError.message);
    if (wasResolved) await event(ctx, text(prior.id), "reopened", "resolved", text(changes.status) as ActionStatus, "The source system reported this issue again.", null, true);
  }

  const activeKeys = new Set(alerts.map((alert) => alert.id));
  const accessible = await scope(ctx);
  for (const row of byKey.values()) {
    if (text(row.status) === "resolved" || activeKeys.has(text(row.source_key)) || !visible(row, ctx, accessible)) continue;
    const reconciliationId = text(row.source_key).startsWith("reconciliation-") ? text(row.source_key).slice("reconciliation-".length) : null;
    if (reconciliationId) {
      if (await isReconciliationFindingActive(ctx, reconciliationId, false)) continue;
    } else if (await inventoryAlertActive(ctx, row) !== false) continue;
    if (row.source_resolved_at) continue;
    const baseContext = text(row.context).split(" Source status:", 1)[0];
    const sourceStatus = text(row.status) === "awaiting_verification"
      ? "Source status: The source check is clear. The CEO can now review and verify this completed task."
      : "Source status: The source check is clear. Confirm completion and send this task to the CEO for review.";
    const { error: clearError } = await db.from("operational_actions").update({ context: `${baseContext} ${sourceStatus}`, source_resolved_at: now, updated_at: now }).eq("id", row.id).is("source_resolved_at", null);
    if (clearError) throw new Error(clearError.message);
  }

  const { data: overdue, error: overdueError } = await db.from("operational_actions").select("id,status").eq("org_id", ctx.orgId).in("status", ["open", "assigned", "acknowledged", "in_progress"]).lt("due_at", now);
  if (overdueError) throw new Error(overdueError.message);
  for (const row of overdue ?? []) {
    const { data: changed, error: escalationError } = await db.from("operational_actions").update({ status: "escalated", escalated_at: now, escalation_reason: "The action passed its due date without verified resolution.", updated_at: now }).eq("id", row.id).eq("status", row.status).select("id").maybeSingle();
    if (escalationError) throw new Error(escalationError.message);
    if (changed) await event(ctx, text(row.id), "escalated", text(row.status) as ActionStatus, "escalated", "Due date passed without verified resolution.", null, true);
  }
}

async function ownerOptions(ctx: AccessContext): Promise<ActionOwner[]> {
  if (ctx.role !== "ceo") return [];
  const now = new Date().toISOString();
  const { data: people, error } = await db.from("profiles").select("id,full_name").eq("org_id", ctx.orgId).eq("role", "farm_manager").eq("is_active", true).order("full_name");
  if (error) throw new Error(error.message);
  const ids = (people ?? []).map((row: Row) => text(row.id));
  if (!ids.length) return [];
  const [farmAccess, warehouseAccess] = await Promise.all([
    db.from("user_farm_access").select("profile_id,farm_id,farms(name)").eq("org_id", ctx.orgId).in("profile_id", ids).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`),
    db.from("user_warehouse_access").select("profile_id,warehouse_id,warehouses(name)").eq("org_id", ctx.orgId).in("profile_id", ids).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);
  return (people ?? []).map((person: Row) => {
    const farms = (farmAccess.data ?? []).filter((row: Row) => text(row.profile_id) === text(person.id)).map((row: Row) => text((row.farms as Row | null)?.name)).filter(Boolean);
    const warehouses = (warehouseAccess.data ?? []).filter((row: Row) => text(row.profile_id) === text(person.id)).map((row: Row) => text((row.warehouses as Row | null)?.name)).filter(Boolean);
    return { id: text(person.id), name: text(person.full_name) || "Farm Manager", scope: [...farms, ...warehouses].join(" · ") || "No active operational assignment" };
  });
}

export async function loadActionDesk(ctx: AccessContext): Promise<ActionDesk> {
  const alerts = await collectOperationalAlerts(ctx);
  await synchronize(ctx, alerts);
  const ids = await scope(ctx);
  const { data, error } = await db.from("operational_actions").select("*,owner:profiles!operational_actions_owner_id_fkey(full_name),operational_action_events(id,event_type,actor_name_snapshot,actor_role_snapshot,note,created_at)").eq("org_id", ctx.orgId).in("status", activeStatuses).order("due_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter((row: Row) => visible(row, ctx, ids));
  const actions: ActionCard[] = rows.map((row: Row) => {
    const owner = row.owner as Row | null;
    const events = ((row.operational_action_events as Row[] | null) ?? []).sort((a, b) => text(b.created_at).localeCompare(text(a.created_at))).slice(0, 8).map((item): ActionEvent => ({ id: text(item.id), eventType: text(item.event_type), actorName: text(item.actor_name_snapshot), actorRole: text(item.actor_role_snapshot), note: nullable(item.note), createdAt: text(item.created_at) }));
    const isOwner = text(row.owner_id) === ctx.userId;
    const unownedInScope = !row.owner_id && visible(row, ctx, ids);
    return {
      actionId: text(row.id), id: text(row.source_key), title: text(row.title), severity: text(row.severity) as ActionCard["severity"],
      source: text(row.source_name), context: text(row.context), route: text(row.source_route), createdAt: text(row.source_first_seen_at),
      farmId: nullable(row.farm_id), warehouseId: nullable(row.warehouse_id), status: text(row.status) as ActionStatus,
      ownerId: nullable(row.owner_id), ownerName: nullable(owner?.full_name), dueAt: text(row.due_at), acknowledgedAt: nullable(row.acknowledged_at),
      resolutionSummary: nullable(row.resolution_summary), resolutionEvidence: nullable(row.resolution_evidence), escalatedAt: nullable(row.escalated_at),
      canAssign: ctx.role === "ceo", canClaim: ctx.role === "farm_manager" && unownedInScope, canWork: (ctx.role === "farm_manager" && isOwner) || ctx.role === "ceo", events,
    };
  });
  const soon = Date.now() + 24 * 3600000;
  return {
    role: ctx.role, viewerId: ctx.userId, actions, owners: await ownerOptions(ctx),
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
  if (text(row.owner_id) === ctx.userId) return;
  if (row.farm_id && await canAccessFarm(ctx, text(row.farm_id))) return;
  if (row.warehouse_id && await canAccessWarehouse(ctx, text(row.warehouse_id))) return;
  throw new Error("This action is outside your active assignment.");
}

async function assertAssignableOwner(ctx: AccessContext, row: Row, ownerId: string) {
  const { data: profile } = await db.from("profiles").select("id,role,is_active").eq("id", ownerId).eq("org_id", ctx.orgId).maybeSingle();
  if (!profile || profile.role !== "farm_manager" || !profile.is_active) throw new Error("Choose an active Farm Manager.");
  const now = new Date().toISOString();
  if (row.farm_id) {
    const { data } = await db.from("user_farm_access").select("id").eq("profile_id", ownerId).eq("farm_id", row.farm_id).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
    if (!data) throw new Error("That Farm Manager is not assigned to the affected farm.");
  }
  if (row.warehouse_id) {
    const { data } = await db.from("user_warehouse_access").select("id").eq("profile_id", ownerId).eq("warehouse_id", row.warehouse_id).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
    if (!data) throw new Error("That Farm Manager is not assigned to the affected warehouse.");
  }
}

export async function transitionAction(ctx: AccessContext, actionId: string, input: unknown) {
  const command = commandSchema.parse(input);
  const { data: row, error } = await db.from("operational_actions").select("*").eq("id", actionId).eq("org_id", ctx.orgId).maybeSingle();
  if (error || !row) throw new Error(error?.message ?? "Action not found.");
  await assertScope(ctx, row);
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
  } else {
    if (ctx.role === "farm_manager" && text(row.owner_id) !== ctx.userId) throw new Error("This action must be assigned to you before you can update it.");
    if (command.command === "acknowledge") changes = { ...changes, status: actionStatusAfter("acknowledge", before), acknowledged_by: ctx.userId, acknowledged_at: now };
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
      const inventoryActive = await inventoryAlertActive(ctx, row);
      const findingId = text(row.source_key).startsWith("reconciliation-") ? text(row.source_key).slice("reconciliation-".length) : null;
      const sourceActive = findingId ? await isReconciliationFindingActive(ctx, findingId, true) : inventoryActive ?? (await collectOperationalAlerts(ctx)).some((alert) => alert.id === text(row.source_key));
      if (sourceActive) {
        changes = { ...changes, status: actionStatusAfter("verify", before, true) }; eventType = "verification_failed"; note = "The originating check still reports this issue.";
      } else {
        changes = { ...changes, status: actionStatusAfter("verify", before, false), source_resolved_at: now }; eventType = "system_verified"; note = "The originating check no longer reports this issue.";
      }
    }
  }
  const after = text(changes.status ?? before) as ActionStatus;
  const { data: updated, error: updateError } = await db.from("operational_actions").update(changes).eq("id", actionId).eq("org_id", ctx.orgId).select("*").single();
  if (updateError) throw new Error(updateError.message);
  await event(ctx, actionId, eventType, before, after, note, evidence);
  await recordAuditEvent(ctx, { eventType: `operational_action.${eventType}`, operation: eventType === "assigned" ? "decision" : "update", entityTable: "operational_actions", entityId: actionId, reason: note ?? `Action ${eventType}`, before: row, after: updated, farmId: nullable(row.farm_id), warehouseId: nullable(row.warehouse_id), metadata: { sourceKey: text(row.source_key) } });
  return updated;
}
