import type {ReportInput} from "./report-workspace";

export type EvidenceRow = Record<string, unknown>;
export type EvidenceScope = {orgId: string; farmIds: string[]; flockIds: string[]; farmNames: Map<string, string>; flockNames: Map<string, string>; restricted: boolean};
export type EvidenceItem = {kind: "disease" | "treatment" | "observation" | "vaccination" | "expense" | "period"; label: string; date: string; endDate?: string; context: string; note?: string; status?: "draft" | "reconciled" | "locked"; amount?: number; unallocated?: number; warnings?: number};
export type ReportEvidence = {dateFrom: string; dateTo: string; items: EvidenceItem[]; expenseTotal?: number};
export class ReportEvidenceError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {super(code); this.code = code; this.status = status;}
}
const text = (value: unknown) => typeof value === "string" ? value : "";
const amount = (value: unknown) => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) ? Number(value) : undefined;

// Trusted assignment-filtered metadata only. A requested scope never grants access.
export function selectEvidenceScope(orgId: string, restricted: boolean, farms: EvidenceRow[], flocks: EvidenceRow[], input: ReportInput, metadata: {houses?: EvidenceRow[]; batches?: EvidenceRow[]; branches?: EvidenceRow[]} = {}): EvidenceScope {
  const tenantFarms = farms.filter(row => row.org_id === orgId);
  const tenantFlocks = flocks.filter(row => row.org_id === orgId && tenantFarms.some(farm => farm.id === row.farm_id));
  const scopedMetadata = (rows: EvidenceRow[]) => rows.filter(row => row.org_id === orgId && tenantFarms.some(farm => farm.id === row.farm_id));
  const houses = scopedMetadata(metadata.houses ?? tenantFlocks.map(row => ({...row, id: row.house_id})));
  const batches = scopedMetadata(metadata.batches ?? tenantFlocks.map(row => ({...row, id: row.batch_id})));
  const branches = (metadata.branches ?? tenantFarms.map(row => ({...row, id: row.branch_id}))).filter(row => row.org_id === orgId);
  for (const [key, records, column] of [["farmId", tenantFarms, "id"], ["branchId", branches, "id"], ["houseId", houses, "id"], ["flockId", tenantFlocks, "id"], ["batchId", batches, "id"]] as const) {
    if (input[key] && !records.some(row => row[column] === input[key])) throw new ReportEvidenceError("REPORT_SCOPE_DENIED", 403);
  }
  const selectedFarms = tenantFarms.filter(row => (!input.farmId || row.id === input.farmId) && (!input.branchId || row.branch_id === input.branchId));
  const farmIds = selectedFarms.map(row => text(row.id));
  const selectedFlocks = tenantFlocks.filter(row => farmIds.includes(text(row.farm_id)) && (!input.houseId || row.house_id === input.houseId) && (!input.flockId || row.id === input.flockId) && (!input.batchId || row.batch_id === input.batchId));
  if (input.flockId && !selectedFlocks.length || input.houseId && !houses.some(row => row.id === input.houseId && farmIds.includes(text(row.farm_id))) || input.batchId && !batches.some(row => row.id === input.batchId && farmIds.includes(text(row.farm_id)) && (!input.houseId || row.house_id === input.houseId))) throw new ReportEvidenceError("REPORT_SCOPE_DENIED", 403);
  return {orgId, restricted: restricted || Boolean(input.farmId || input.houseId || input.flockId || input.batchId), farmIds, flockIds: selectedFlocks.map(row => text(row.id)), farmNames: new Map(selectedFarms.map(row => [text(row.id), text(row.name)])), flockNames: new Map(selectedFlocks.map(row => [text(row.id), text(row.flock_code)]))};
}

export function projectReportEvidence(section: "health" | "finance", input: ReportInput, scope: EvidenceScope, sources: {events?: EvidenceRow[]; vaccinations?: EvidenceRow[]; expenses?: EvidenceRow[]; periods?: EvidenceRow[]}): ReportEvidence {
  const within = (date: string) => date >= input.dateFrom && date <= input.dateTo;
  const result: ReportEvidence = {dateFrom: input.dateFrom, dateTo: input.dateTo, items: []};
  if (section === "health") {
    const events = (sources.events ?? []).filter(row => row.org_id === scope.orgId && !row.voided_at && scope.flockIds.includes(text(row.flock_id)) && within(text(row.event_date)));
    result.items = events.filter(row => !/^SCHEDULE_(STATUS|TARGET)\|/.test(text(row.description)) && ["disease", "treatment", "observation"].includes(text(row.event_type))).map(row => ({kind: text(row.event_type) as EvidenceItem["kind"], label: text(row.diagnosis) || text(row.description), date: text(row.event_date), context: scope.flockNames.get(text(row.flock_id)) || "", note: text(row.treatment)}));
    const seen = new Set<string>();
    for (const row of events) {
      const match = /^SCHEDULE_STATUS\|([^|]+)\|completed\|vaccination$/.exec(text(row.description));
      if (!match || seen.has(match[1])) continue;
      const vaccine = sources.vaccinations?.find(record => record.id === match[1] && record.org_id === scope.orgId && record.flock_id === row.flock_id && !record.voided_at);
      if (!vaccine) continue;
      seen.add(match[1]);
      result.items.push({kind: "vaccination", label: text(vaccine.vaccine_name), date: text(row.event_date), context: scope.flockNames.get(text(row.flock_id)) || ""});
    }
  } else {
    const allowed = (row: EvidenceRow) => row.org_id === scope.orgId && (!scope.restricted || scope.farmIds.includes(text(row.farm_id))) && (!input.branchId || row.branch_id === input.branchId) && (!input.houseId || row.house_id === input.houseId) && (!input.flockId || row.flock_id === input.flockId) && (!input.batchId || row.batch_id === input.batchId);
    const expenses = (sources.expenses ?? []).filter(row => allowed(row) && within(text(row.entry_date)));
    result.expenseTotal = expenses.every(row => amount(row.amount) !== undefined) ? expenses.reduce((sum, row) => sum + Number(row.amount), 0) : undefined;
    result.items = expenses.map(row => ({kind: "expense", label: text(row.description), date: text(row.entry_date), context: scope.farmNames.get(text(row.farm_id)) || "", amount: amount(row.amount)}));
    for (const row of sources.periods ?? []) {
      if (!allowed(row) || text(row.period_start) > input.dateTo || text(row.period_end) < input.dateFrom) continue;
      result.items.push({kind: "period", label: "", date: text(row.period_start), endDate: text(row.period_end), context: scope.farmNames.get(text(row.farm_id)) || "", status: ["draft", "reconciled", "locked"].includes(text(row.status)) ? text(row.status) as EvidenceItem["status"] : undefined, amount: amount(row.total_absorbed_cost), unallocated: amount(row.unallocated_cost), warnings: Array.isArray(row.reconciliation_warnings) ? row.reconciliation_warnings.length : undefined});
    }
  }
  return result;
}

// Stable ordering is the adapter's responsibility. Never return a partial total.
export async function readAllEvidence(read: (start: number, end: number) => Promise<EvidenceRow[]>, size = 500, maximum = 20000) {
  const result: EvidenceRow[] = [];
  for (let start = 0; start <= maximum; start += size) {
    const rows = await read(start, start + size - 1);
    result.push(...rows);
    if (result.length > maximum) throw new ReportEvidenceError("REPORT_TOO_LARGE", 422);
    if (rows.length < size) return result;
  }
  throw new ReportEvidenceError("REPORT_TOO_LARGE", 422);
}
