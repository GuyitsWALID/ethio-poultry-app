/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import { canAccessFarm, governanceAdmin, type AccessContext } from "@/lib/access-context";
import { loadOperationsAnalytics } from "@/lib/operations-analytics-service";
import type { OperationsAnalyticsResponse } from "@/lib/operational-analytics";
import {reportCsvCell, reportTimestampBounds} from "@/lib/report-safety";
import {executeReportGeneration, ReportBusyError, type ReportClaim} from "@/lib/report-generation";
import {scopedReportVersion, readableReportVersion, type ReportResources} from "@/lib/report-snapshot";
import {readSavedReportCursor, savedReportPage, type SavedReportSummary} from "@/lib/saved-report-page";

const db = governanceAdmin as any;
const REPORT_VERSION = scopedReportVersion;
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

function analyticsParams(scope: Scope, periodFrom: string, periodTo: string) {
  const params = new URLSearchParams({ date_from: periodFrom, date_to: periodTo });
  for (const [key, value] of Object.entries(scope)) if (value) params.set(key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value);
  return params;
}

async function loadAnalytics(ctx: AccessContext, scope: Scope, periodFrom: string, periodTo: string) {
  let resources: ReportResources | undefined;
  const response = await loadOperationsAnalytics(ctx, analyticsParams(scope, periodFrom, periodTo), captured => {resources = captured;});
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "The authoritative report data could not be loaded.");
  if (!resources) throw new Error("REPORT_RESOURCE_PROVENANCE_MISSING");
  return {...body as OperationsAnalyticsResponse, report_resources: resources};
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

export async function getManagementReportCenter(ctx: AccessContext, cursor: string | null = null) {
  if (ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new Error("Management report access is required.");
  let schedules = db.from("management_report_schedules").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false });
  const before = readSavedReportCursor(cursor, ctx.userId, ctx.orgId);
  const runs = db.rpc("page_accessible_management_reports", {p_actor: ctx.userId, p_org: ctx.orgId,
    p_before_time: before?.createdAt ?? null, p_before_id: before?.id ?? null});
  if (ctx.role === "farm_manager") {
    schedules = schedules.contains("recipient_ids", [ctx.userId]);
  }
  const [scheduleResult, runResult, profileResult] = await Promise.all([
    schedules, runs,
    governanceAdmin.from("profiles").select("id,full_name,role").eq("org_id", ctx.orgId).eq("is_active", true).in("role", ["ceo", "farm_manager"]).order("full_name"),
  ]);
  const error = scheduleResult.error ?? runResult.error ?? profileResult.error;
  if (error) throw new Error(error.message);
  const schedulesData = scheduleResult.data ?? [];
  const page = savedReportPage((runResult.data ?? []) as SavedReportSummary[], ctx.userId, ctx.orgId);
  if (ctx.role === "farm_manager") {
    const visibleSchedules: Row[] = [];
    for (const row of schedulesData) if (row.scope?.farmId && await canAccessFarm(ctx, String(row.scope.farmId))) visibleSchedules.push(row);
    return { currentUserId: ctx.userId, capabilities: { canSchedule: false, canGenerate: true }, schedules: visibleSchedules, ...page, recipients: profileResult.data ?? [] };
  }
  return { currentUserId: ctx.userId, capabilities: { canSchedule: true, canGenerate: true }, schedules: schedulesData, ...page, recipients: profileResult.data ?? [] };
}

export async function createManagementReportSchedule(ctx: AccessContext, input: unknown) {
  if (ctx.role !== "ceo" || ctx.supportSessionId) throw new Error("Only the tenant CEO can schedule management reports.");
  const values = scheduleSchema.parse(input);
  const recipients = await validRecipients(ctx, values.recipientIds, values.scope);
  return reportRpc("create_management_report_schedule", {
    p_org: ctx.orgId, p_actor: ctx.userId, p_values: {...values, recipientIds: recipients.ids},
    p_next_run: nextRun(values.cadence, values.runDay, values.runHour),
  });
}

export async function setManagementReportScheduleActive(ctx: AccessContext, scheduleId: string, active: boolean) {
  if (ctx.role !== "ceo" || ctx.supportSessionId) throw new Error("Only the tenant CEO can change report schedules.");
  z.string().uuid().parse(scheduleId);
  const { data: before, error } = await db.from("management_report_schedules").select("*").eq("id", scheduleId).eq("org_id", ctx.orgId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!before) throw new Error("Report schedule not found.");
  return reportRpc("set_management_report_schedule_active", {
    p_org: ctx.orgId, p_actor: ctx.userId, p_id: scheduleId, p_active: active,
    p_expected_revision: before.updated_at,
    p_next_run: active ? nextRun(before.cadence, before.run_day, before.run_hour) : null,
  });
}

async function reportRpc(name: string, args: Record<string, unknown>) {
  const {data, error} = await db.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function generateManagementReport(ctx: AccessContext, _origin: string, input: { name?: string; scope?: unknown; periodFrom?: string; periodTo?: string; recipientIds?: string[]; scheduleId?: string; commandId?: string }, options: { scheduled?: boolean; nextRunAt?: string; scheduleRevision?: string } = {}) {
  if (ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new Error("Management report access is required.");
  const scope = scopeSchema.parse(input.scope ?? {});
  if (ctx.role === "farm_manager" && !scope.farmId) throw new Error("Choose one assigned farm before saving a management report.");
  const today = addisDate();
  const periodTo = input.periodTo ?? today;
  const periodFrom = input.periodFrom ?? shiftDate(periodTo, -29);
  reportTimestampBounds(periodFrom, periodTo);
  const recipients = await validRecipients(ctx, ctx.role === "ceo" ? input.recipientIds ?? [] : [], scope);
  const orgName = await organizationName(ctx.orgId);
  const name = (input.name?.trim() || "Management performance report").slice(0, 100);
  const scheduleId = options.scheduled ? z.string().uuid().parse(input.scheduleId) : null;
  const request = {name, scope, periodFrom, periodTo, recipientIds: recipients.ids.sort(), scheduleId, scheduleRevision: options.scheduleRevision ?? null, version: REPORT_VERSION};
  const payloadHash = createHash("sha256").update(JSON.stringify(request)).digest("hex");
  const key = scheduleId ? `schedule:${scheduleId}:${periodFrom}:${periodTo}:${options.scheduleRevision ?? "legacy"}` : `manual:${input.commandId ? z.string().uuid().parse(input.commandId) : randomUUID()}`;
  const base = {p_org: ctx.orgId, p_actor: ctx.userId, p_key: key};
  const id = await executeReportGeneration({
    claim: async () => await reportRpc("claim_management_report", {...base, p_hash: payloadHash, p_request: request}) as ReportClaim,
    load: () => loadAnalytics(ctx, scope, periodFrom, periodTo),
    finish: async (token, snapshot) => await reportRpc("finish_management_report", {...base, p_token: token,
      p_snapshot: snapshot, p_snapshot_hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      p_organization: orgName, p_next_run: options.nextRunAt ?? null}) as string,
    fail: async (token, error) => await reportRpc("fail_management_report", {...base, p_token: token,
      p_message: error instanceof Error ? error.message : "Report generation failed.", p_organization: orgName}),
  });
  const data = await getManagementReportRun(ctx, id);
  return {id: data.id, report_name: data.report_name, period_from: data.period_from, period_to: data.period_to, status: data.status, generated_at: data.generated_at};
}

export async function dispatchScheduledManagementReports(origin: string) {
  const { data: schedules, error } = await db.from("management_report_schedules").select("*").eq("is_active", true).lte("next_run_at", new Date().toISOString()).order("next_run_at").limit(20);
  if (error) throw new Error(error.message);
  let completed = 0, failed = 0, skipped = 0;
  for (const schedule of schedules ?? []) {
    const ctx: AccessContext = { userId: String(schedule.created_by), homeOrgId: String(schedule.org_id), orgId: String(schedule.org_id), role: "ceo", capabilities: [], supportSessionId: null, supportExpiresAt: null };
    // Keep the original due operating period fixed across retries and midnight.
    const period = reportPeriod(schedule.cadence, Number(schedule.lookback_days), new Date(schedule.next_run_at));
    try {
      const {data: creator, error: creatorError} = await db.from("profiles").select("role,is_active").eq("org_id", ctx.orgId).eq("id", ctx.userId).maybeSingle();
      if (creatorError || !creator?.is_active || creator.role !== "ceo") throw new Error("Report schedule requires its creator's current CEO authority.");
      ctx.role = creator.role;
      await generateManagementReport(ctx, origin, { name: schedule.name, scope: schedule.scope, ...period, recipientIds: schedule.recipient_ids, scheduleId: schedule.id }, { scheduled: true, nextRunAt: nextRun(schedule.cadence, Number(schedule.run_day), Number(schedule.run_hour)), scheduleRevision: schedule.updated_at }); completed += 1;
    }
    catch (error) { if (error instanceof ReportBusyError) skipped += 1; else failed += 1; }
  }
  return { due: schedules?.length ?? 0, completed, failed, skipped };
}

export async function getManagementReportRun(ctx: AccessContext, runId: string, allowFailed = false) {
  if (ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new Error("Management report access is required.");
  const { data, error } = await db.rpc("read_accessible_management_report", {p_actor: ctx.userId, p_id: z.string().uuid().parse(runId)}).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Report not found.");
  if (data.org_id !== ctx.orgId) throw new Error("This report is outside your access.");
  if (!allowFailed && (data.status !== "completed" || !data.report_snapshot)) throw new Error("This report has no completed snapshot.");
  return data;
}

function html(value: unknown) { return String(value ?? "Unavailable").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
function display(value: number | null, suffix = "") { return value === null ? "Unavailable" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}`; }

export function renderManagementReportHtml(run: Row) {
  const REPORT_VERSION = readableReportVersion(run.report_version);
  const data = run.report_snapshot as OperationsAnalyticsResponse; const summary = data.summary.current;
  const cards = [["Live birds", data.summary.liveBirds], ["Active flocks", data.summary.activeFlocks], ["Eggs", summary.eggs], ["HDEP", display(summary.hdep, "%")], ["Feed / bird", display(summary.feedPerBirdGrams, " g")], ["Mortality / 1,000 bird-days", display(summary.mortalityPer1000BirdDays)], ["Record coverage", display(summary.recordCoveragePct, "%")], ["Feed cost", data.economics.feedCost === null ? "Unavailable" : `ETB ${display(data.economics.feedCost)}`]];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${html(run.report_name)}</title><style>body{margin:0;background:#f7f4ed;color:#15271b;font:14px Arial,sans-serif}.wrap{max-width:920px;margin:auto;padding:40px}.hero{background:#14281b;color:white;padding:34px;border-radius:22px}.eyebrow{color:#f3b61f;text-transform:uppercase;letter-spacing:.18em;font-size:11px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.card,.section{background:white;border:1px solid #ded6c5;border-radius:14px;padding:18px}.card strong{display:block;font:700 24px Georgia,serif;margin-top:8px}.section{margin-top:16px}.issue{border-left:4px solid #e6a315;padding:10px 14px;margin:10px 0;background:#fbf8f0}.muted{color:#5a695e}footer{margin-top:24px;font-size:12px;color:#5a695e}@media(max-width:700px){.grid{grid-template-columns:repeat(2,1fr)}.wrap{padding:16px}}</style></head><body><div class="wrap"><div class="hero"><div class="eyebrow">${html(run.organization_name)} · Management report</div><h1>${html(run.report_name)}</h1><p>${html(data.meta.scopeLabel)} · ${html(run.period_from)} to ${html(run.period_to)}</p></div><div class="grid">${cards.map(([label, value]) => `<div class="card"><span class="muted">${html(label)}</span><strong>${html(value)}</strong></div>`).join("")}</div><div class="section"><h2>Management attention</h2>${data.insights.map((item) => `<div class="issue"><strong>${html(item.title)}</strong><p>${html(item.detail)}</p></div>`).join("") || "<p>No priority exception was identified.</p>"}</div><div class="section"><h2>Data confidence</h2><p>Daily Records: ${html(display(data.dataTrust.recordCoveragePct, "%"))} · Feed synchronization: ${html(display(data.dataTrust.feedDataCoveragePct, "%"))} · Mortality causes: ${html(display(data.dataTrust.mortalityCauseCoveragePct, "%"))}</p>${data.dataTrust.notes.map((note) => `<p class="muted">${html(note)}</p>`).join("")}</div><footer>Generated ${html(run.generated_at)} · Africa/Addis_Ababa · Snapshot ${html(String(run.snapshot_sha256).slice(0, 12))} · ${REPORT_VERSION}</footer></div></body></html>`;
}

export function renderManagementReportCsv(run: Row) {
  readableReportVersion(run.report_version);
  const data = run.report_snapshot as OperationsAnalyticsResponse; const current = data.summary.current;
  const rows: unknown[][] = [[run.organization_name], [run.report_name], ["Scope", data.meta.scopeLabel], ["Period", `${run.period_from} to ${run.period_to}`], [], ["Metric", "Value"], ["Live birds", data.summary.liveBirds], ["Active flocks", data.summary.activeFlocks], ["Eggs", current.eggs], ["HDEP %", current.hdep], ["Feed g/bird", current.feedPerBirdGrams], ["Mortality/1k bird-days", current.mortalityPer1000BirdDays], ["Record coverage %", current.recordCoveragePct], [], ["Priority", "Assessment"], ...data.insights.map((item) => [item.title, item.detail])];
  return `\uFEFF${rows.map((row) => row.map(reportCsvCell).join(",")).join("\r\n")}`;
}
