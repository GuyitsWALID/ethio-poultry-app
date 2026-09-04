/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { canAccessFarm, governanceAdmin, type AccessContext } from "@/lib/access-context";
import { recordAuditEvent } from "@/lib/audit-ledger";
import type { OperationsAnalyticsResponse } from "@/lib/operational-analytics";

const db = governanceAdmin as any;
const REPORT_VERSION = "management-report-v1";
const scopeSchema = z.object({
  branchId: z.string().uuid().optional(), farmId: z.string().uuid().optional(), houseId: z.string().uuid().optional(),
  flockId: z.string().uuid().optional(), batchId: z.string().uuid().optional(),
}).strict();
const scheduleSchema = z.object({
  name: z.string().trim().min(3).max(100), cadence: z.enum(["weekly", "monthly"]), runDay: z.number().int().min(1).max(28),
  runHour: z.number().int().min(0).max(23).default(7), lookbackDays: z.number().int().min(1).max(366).default(30),
  scope: scopeSchema.default({}), recipientIds: z.array(z.string().uuid()).max(25).default([]),
}).strict().superRefine((value, context) => {
  if (value.cadence === "weekly" && value.runDay > 7) context.addIssue({ code: "custom", path: ["runDay"], message: "Weekly reports require a weekday from Monday through Sunday." });
});

type Row = Record<string, any>;
type Scope = z.infer<typeof scopeSchema>;

function addisDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}

function nextRun(cadence: "weekly" | "monthly", runDay: number, runHour: number, from = new Date()) {
  const local = new Date(from.getTime() + 3 * 60 * 60 * 1000);
  let candidate: Date;
  if (cadence === "weekly") {
    const currentDay = local.getUTCDay() || 7;
    const delta = runDay - currentDay;
    candidate = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + delta, runHour - 3));
    if (candidate <= from) candidate = new Date(candidate.getTime() + 7 * 86400000);
  } else {
    candidate = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), runDay, runHour - 3));
    if (candidate <= from) candidate = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, runDay, runHour - 3));
  }
  return candidate.toISOString();
}

function reportPeriod(cadence: "weekly" | "monthly", lookbackDays: number, now = new Date()) {
  const today = addisDate(now);
  const periodTo = shiftDate(today, -1);
  if (cadence === "monthly") {
    const firstThisMonth = `${today.slice(0, 7)}-01`;
    const to = shiftDate(firstThisMonth, -1);
    return { periodFrom: `${to.slice(0, 7)}-01`, periodTo: to };
  }
  return { periodFrom: shiftDate(periodTo, -lookbackDays + 1), periodTo };
}

function analyticsParams(scope: Scope, periodFrom: string, periodTo: string, ctx: AccessContext) {
  const params = new URLSearchParams({ date_from: periodFrom, date_to: periodTo, internal_org_id: ctx.orgId, internal_user_id: ctx.userId });
  for (const [key, value] of Object.entries(scope)) if (value) params.set(key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value);
  return params;
}

async function loadAnalytics(ctx: AccessContext, origin: string, scope: Scope, periodFrom: string, periodTo: string) {
  const token = process.env.MONITORING_INGEST_TOKEN?.trim();
  if (!token) throw new Error("Report generation is not configured for this deployment.");
  const response = await fetch(`${origin}/api/operations-analytics?${analyticsParams(scope, periodFrom, periodTo, ctx)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "The authoritative report data could not be loaded.");
  return body as OperationsAnalyticsResponse;
}

async function organizationName(orgId: string) {
  const { data, error } = await governanceAdmin.from("organizations").select("name").eq("id", orgId).single();
  if (error) throw new Error(error.message);
  return String(data.name ?? "Poultry operations");
}

async function validRecipients(ctx: AccessContext, recipientIds: string[], scope: Scope) {
  const ids = [...new Set([ctx.userId, ...recipientIds])];
  const { data, error } = await governanceAdmin.from("profiles").select("id,full_name,role,is_active").eq("org_id", ctx.orgId).in("id", ids).eq("is_active", true).in("role", ["ceo", "farm_manager"]);
  if (error) throw new Error(error.message);
  const valid = new Set((data ?? []).map((row) => String(row.id)));
  if (ids.some((id) => !valid.has(id))) throw new Error("Every report recipient must be an active CEO or Farm Manager in this organization.");
  const managers = (data ?? []).filter((row) => row.role === "farm_manager");
  if (managers.length) {
    if (!scope.farmId) throw new Error("Choose one farm before sharing a report with a Farm Manager.");
    const now = new Date().toISOString();
    const managerIds = managers.map((row) => String(row.id));
    const { data: assignments, error: assignmentError } = await governanceAdmin.from("user_farm_access").select("profile_id").eq("org_id", ctx.orgId).eq("farm_id", scope.farmId).in("profile_id", managerIds).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`);
    if (assignmentError) throw new Error(assignmentError.message);
    const assigned = new Set((assignments ?? []).map((row) => String(row.profile_id)));
    if (managerIds.some((id) => !assigned.has(id))) throw new Error("A Farm Manager can receive only a report for a farm currently assigned to them.");
  }
  return { ids, profiles: data ?? [] };
}

export async function getManagementReportCenter(ctx: AccessContext) {
  if (ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new Error("Management report access is required.");
  let schedules = db.from("management_report_schedules").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false });
  let runs = db.from("management_report_runs").select("id,schedule_id,requested_by,requested_role,report_name,period_from,period_to,scope,recipient_ids,organization_name,status,failure_message,generated_at,created_at").eq("org_id", ctx.orgId).order("created_at", { ascending: false }).limit(30);
  if (ctx.role === "farm_manager") {
    schedules = schedules.contains("recipient_ids", [ctx.userId]);
    runs = runs.or(`requested_by.eq.${ctx.userId},recipient_ids.cs.{${ctx.userId}}`);
  }
  const [scheduleResult, runResult, profileResult] = await Promise.all([
    schedules, runs,
    governanceAdmin.from("profiles").select("id,full_name,role").eq("org_id", ctx.orgId).eq("is_active", true).in("role", ["ceo", "farm_manager"]).order("full_name"),
  ]);
  const error = scheduleResult.error ?? runResult.error ?? profileResult.error;
  if (error) throw new Error(error.message);
  const schedulesData = scheduleResult.data ?? []; const runsData = runResult.data ?? [];
  if (ctx.role === "farm_manager") {
    const visibleSchedules: Row[] = []; const visibleRuns: Row[] = [];
    for (const row of schedulesData) if (row.scope?.farmId && await canAccessFarm(ctx, String(row.scope.farmId))) visibleSchedules.push(row);
    for (const row of runsData) if (row.scope?.farmId && await canAccessFarm(ctx, String(row.scope.farmId))) visibleRuns.push(row);
    return { capabilities: { canSchedule: false, canGenerate: true }, schedules: visibleSchedules, runs: visibleRuns, recipients: profileResult.data ?? [] };
  }
  return { capabilities: { canSchedule: true, canGenerate: true }, schedules: schedulesData, runs: runsData, recipients: profileResult.data ?? [] };
}

export async function createManagementReportSchedule(ctx: AccessContext, input: unknown) {
  if (ctx.role !== "ceo" || ctx.supportSessionId) throw new Error("Only the tenant CEO can schedule management reports.");
  const values = scheduleSchema.parse(input);
  const recipients = await validRecipients(ctx, values.recipientIds, values.scope);
  const { data, error } = await db.from("management_report_schedules").insert({
    org_id: ctx.orgId, created_by: ctx.userId, name: values.name, cadence: values.cadence, run_day: values.runDay,
    run_hour: values.runHour, lookback_days: values.lookbackDays, scope: values.scope, recipient_ids: recipients.ids,
    next_run_at: nextRun(values.cadence, values.runDay, values.runHour),
  }).select("*").single();
  if (error) throw new Error(error.message);
  await recordAuditEvent(ctx, { eventType: "management_report.schedule_created", operation: "insert", entityTable: "management_report_schedules", entityId: String(data.id), reason: `Scheduled ${values.name}.`, after: data });
  return data;
}

export async function setManagementReportScheduleActive(ctx: AccessContext, scheduleId: string, active: boolean) {
  if (ctx.role !== "ceo" || ctx.supportSessionId) throw new Error("Only the tenant CEO can change report schedules.");
  const { data: before } = await db.from("management_report_schedules").select("*").eq("id", scheduleId).eq("org_id", ctx.orgId).maybeSingle();
  if (!before) throw new Error("Report schedule not found.");
  const { data, error } = await db.from("management_report_schedules").update({ is_active: active, next_run_at: active ? nextRun(before.cadence, before.run_day, before.run_hour) : before.next_run_at, updated_at: new Date().toISOString() }).eq("id", scheduleId).select("*").single();
  if (error) throw new Error(error.message);
  await recordAuditEvent(ctx, { eventType: active ? "management_report.schedule_resumed" : "management_report.schedule_paused", operation: "update", entityTable: "management_report_schedules", entityId: scheduleId, reason: active ? "Resumed the report schedule." : "Paused the report schedule.", before, after: data });
  return data;
}

export async function generateManagementReport(ctx: AccessContext, origin: string, input: { name?: string; scope?: unknown; periodFrom?: string; periodTo?: string; recipientIds?: string[]; scheduleId?: string }, options: { scheduled?: boolean } = {}) {
  if (ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new Error("Management report access is required.");
  const scope = scopeSchema.parse(input.scope ?? {});
  if (ctx.role === "farm_manager" && !scope.farmId) throw new Error("Choose one assigned farm before saving a management report.");
  const today = addisDate();
  const periodTo = input.periodTo && /^\d{4}-\d{2}-\d{2}$/.test(input.periodTo) ? input.periodTo : today;
  const periodFrom = input.periodFrom && /^\d{4}-\d{2}-\d{2}$/.test(input.periodFrom) ? input.periodFrom : shiftDate(periodTo, -29);
  if (periodFrom > periodTo) throw new Error("Choose a valid report period.");
  const recipients = await validRecipients(ctx, ctx.role === "ceo" ? input.recipientIds ?? [] : [], scope);
  const orgName = await organizationName(ctx.orgId);
  const name = (input.name?.trim() || "Management performance report").slice(0, 100);
  try {
    const snapshot = await loadAnalytics(ctx, origin, scope, periodFrom, periodTo);
    const snapshotSha256 = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    const scheduleId = options.scheduled ? input.scheduleId ?? null : null;
    const { data, error } = await db.from("management_report_runs").insert({ org_id: ctx.orgId, schedule_id: scheduleId, requested_by: ctx.userId, requested_role: ctx.role, report_name: name, period_from: periodFrom, period_to: periodTo, scope, recipient_ids: recipients.ids, organization_name: orgName, report_snapshot: snapshot, snapshot_sha256: snapshotSha256, report_version: REPORT_VERSION, status: "completed", generated_at: new Date().toISOString() }).select("id,report_name,period_from,period_to,status,generated_at").single();
    if (error) throw new Error(error.message);
    await recordAuditEvent(ctx, { eventType: "management_report.generated", operation: "execute", entityTable: "management_report_runs", entityId: String(data.id), reason: `Generated ${name} for ${periodFrom} through ${periodTo}.`, metadata: { snapshotSha256, reportVersion: REPORT_VERSION } });
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed.";
    await db.from("management_report_runs").insert({ org_id: ctx.orgId, schedule_id: options.scheduled ? input.scheduleId ?? null : null, requested_by: ctx.userId, requested_role: ctx.role, report_name: name, period_from: periodFrom, period_to: periodTo, scope, recipient_ids: recipients.ids, organization_name: orgName, report_version: REPORT_VERSION, status: "failed", failure_message: message.slice(0, 500) });
    throw error;
  }
}

export async function dispatchScheduledManagementReports(origin: string) {
  const { data: schedules, error } = await db.from("management_report_schedules").select("*").eq("is_active", true).lte("next_run_at", new Date().toISOString()).order("next_run_at").limit(20);
  if (error) throw new Error(error.message);
  let completed = 0, failed = 0;
  for (const schedule of schedules ?? []) {
    const ctx: AccessContext = { userId: String(schedule.created_by), homeOrgId: String(schedule.org_id), orgId: String(schedule.org_id), role: "ceo", capabilities: [], supportSessionId: null, supportExpiresAt: null };
    const period = reportPeriod(schedule.cadence, Number(schedule.lookback_days));
    let succeeded = false;
    try { await generateManagementReport(ctx, origin, { name: schedule.name, scope: schedule.scope, ...period, recipientIds: schedule.recipient_ids, scheduleId: schedule.id }, { scheduled: true }); completed += 1; succeeded = true; }
    catch { failed += 1; }
    await db.from("management_report_schedules").update({ last_run_at: new Date().toISOString(), next_run_at: succeeded ? nextRun(schedule.cadence, Number(schedule.run_day), Number(schedule.run_hour)) : new Date(Date.now() + 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", schedule.id);
  }
  return { due: schedules?.length ?? 0, completed, failed };
}

export async function getManagementReportRun(ctx: AccessContext, runId: string) {
  const { data, error } = await db.from("management_report_runs").select("*").eq("id", runId).eq("org_id", ctx.orgId).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Report not found.");
  if (ctx.role === "farm_manager" && data.requested_by !== ctx.userId && !(data.recipient_ids ?? []).includes(ctx.userId)) throw new Error("This report is outside your access.");
  if (ctx.role === "farm_manager" && (!data.scope?.farmId || !await canAccessFarm(ctx, String(data.scope.farmId)))) throw new Error("This report is outside your current farm assignment.");
  if (data.status !== "completed" || !data.report_snapshot) throw new Error("This report has no completed snapshot.");
  return data;
}

function html(value: unknown) { return String(value ?? "Unavailable").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
function display(value: number | null, suffix = "") { return value === null ? "Unavailable" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}`; }

export function renderManagementReportHtml(run: Row) {
  const data = run.report_snapshot as OperationsAnalyticsResponse; const summary = data.summary.current;
  const cards = [["Live birds", data.summary.liveBirds], ["Active flocks", data.summary.activeFlocks], ["Eggs", summary.eggs], ["HDEP", display(summary.hdep, "%")], ["Feed / bird", display(summary.feedPerBirdGrams, " g")], ["Mortality / 1,000 bird-days", display(summary.mortalityPer1000BirdDays)], ["Record coverage", display(summary.recordCoveragePct, "%")], ["Feed cost", data.economics.feedCost === null ? "Unavailable" : `ETB ${display(data.economics.feedCost)}`]];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${html(run.report_name)}</title><style>body{margin:0;background:#f7f4ed;color:#15271b;font:14px Arial,sans-serif}.wrap{max-width:920px;margin:auto;padding:40px}.hero{background:#14281b;color:white;padding:34px;border-radius:22px}.eyebrow{color:#f3b61f;text-transform:uppercase;letter-spacing:.18em;font-size:11px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card,.section{background:white;border:1px solid #ded6c5;border-radius:14px;padding:18px}.card strong{display:block;font:700 24px Georgia,serif;margin-top:8px}.section{margin-top:16px}.issue{border-left:4px solid #e6a315;padding:10px 14px;margin:10px 0;background:#fbf8f0}.muted{color:#5a695e}footer{margin-top:24px;font-size:12px;color:#5a695e}@media(max-width:700px){.grid{grid-template-columns:repeat(2,1fr)}.wrap{padding:16px}}</style></head><body><div class="wrap"><div class="hero"><div class="eyebrow">${html(run.organization_name)} · Management report</div><h1>${html(run.report_name)}</h1><p>${html(data.meta.scopeLabel)} · ${html(run.period_from)} to ${html(run.period_to)}</p></div><div class="grid">${cards.map(([label, value]) => `<div class="card"><span class="muted">${html(label)}</span><strong>${html(value)}</strong></div>`).join("")}</div><div class="section"><h2>Management attention</h2>${data.insights.map((item) => `<div class="issue"><strong>${html(item.title)}</strong><p>${html(item.detail)}</p></div>`).join("") || "<p>No priority exception was identified.</p>"}</div><div class="section"><h2>Data confidence</h2><p>Daily Records: ${html(display(data.dataTrust.recordCoveragePct, "%"))} · Feed synchronization: ${html(display(data.dataTrust.feedDataCoveragePct, "%"))} · Mortality causes: ${html(display(data.dataTrust.mortalityCauseCoveragePct, "%"))}</p>${data.dataTrust.notes.map((note) => `<p class="muted">${html(note)}</p>`).join("")}</div><footer>Generated ${html(run.generated_at)} · Africa/Addis_Ababa · Snapshot ${html(String(run.snapshot_sha256).slice(0, 12))} · ${REPORT_VERSION}</footer></div></body></html>`;
}

function csv(value: unknown) { return `"${String(value ?? "Unavailable").replaceAll('"', '""')}"`; }
export function renderManagementReportCsv(run: Row) {
  const data = run.report_snapshot as OperationsAnalyticsResponse; const current = data.summary.current;
  const rows: unknown[][] = [[run.organization_name], [run.report_name], ["Scope", data.meta.scopeLabel], ["Period", `${run.period_from} to ${run.period_to}`], [], ["Metric", "Value"], ["Live birds", data.summary.liveBirds], ["Active flocks", data.summary.activeFlocks], ["Eggs", current.eggs], ["HDEP %", current.hdep], ["Feed g/bird", current.feedPerBirdGrams], ["Mortality/1k bird-days", current.mortalityPer1000BirdDays], ["Record coverage %", current.recordCoveragePct], [], ["Priority", "Assessment"], ...data.insights.map((item) => [item.title, item.detail])];
  return `\uFEFF${rows.map((row) => row.map(csv).join(",")).join("\r\n")}`;
}
