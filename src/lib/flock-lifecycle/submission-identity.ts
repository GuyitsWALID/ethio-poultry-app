import {createCycleSchema, closeCycleSchema, wholeFlockMoveSchema, archivedCycleCorrectionSchema} from "./cycle-contracts.ts";

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
  return value;
}

// Only client intent participates. Source targets, labels and correction routes
// are resolved by the authorized lifecycle module, never trusted from the URL.
export function cycleSubmissionIdentity(input: {
  request_type?: string; farm_id?: string | null; reason?: string;
  proposed_values?: Record<string, unknown>;
  references?: Array<{label?: string; url?: string}>;
}): string {
  const schema = input.request_type === "batch_cycle_create" ? createCycleSchema
    : input.request_type === "batch_cycle_close" ? closeCycleSchema
    : input.request_type === "flock_transfer" ? wholeFlockMoveSchema
    : input.request_type === "archived_cycle_correction" ? archivedCycleCorrectionSchema : null;
  if (!schema) throw new Error("CYCLE_INVALID_FIELDS");
  const parsed = schema.safeParse(input.proposed_values);
  if (!parsed.success) throw new Error("CYCLE_INVALID_FIELDS");
  return JSON.stringify(ordered({request_type: input.request_type, farm_id: input.farm_id,
    reason: input.reason?.trim(), proposed_values: parsed.data,
    references: (input.references ?? []).filter(row => row.url?.trim()).map(row => ({label: row.label?.trim() || "Supporting reference", url: row.url!.trim()})),
  }));
}
