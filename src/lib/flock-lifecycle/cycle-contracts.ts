import {z} from "zod";

const text = z.string().trim().min(1).max(120);
const count = z.number().int().min(1).max(2147483647);
const revision = z.string().regex(/^[a-f0-9]{64}$/);
const departure = z.discriminatedUnion("kind", [
  z.object({kind: z.literal("sale"), flock_id: z.uuid(), quantity: count, sale_id: z.uuid(), sale_revision: revision,
    physical_head_count: count.optional(), supporting_reference: z.string().trim().min(3).max(1000).optional()}),
  z.object({kind: z.literal("other"), flock_id: z.uuid(), quantity: count, reason: z.string().trim().min(8).max(2000), supporting_reference: z.string().trim().min(3).max(1000)}),
]);
export const createCycleSchema = z.object({
  farm_id: z.uuid(), cycle_code: text, production_purpose: z.enum(["layer", "broiler", "rearing", "parent_stock"]),
  source: z.enum(["external_purchase", "internal_transfer"]), placed_at: z.iso.datetime({offset: true}), actual_date_confirmed: z.literal(true),
  age_at_placement_days: z.number().int().min(0).max(3650), breed_id: z.uuid().nullable().optional(),
  supplier_name: z.string().trim().max(200).optional(), purchase_cost_per_bird: z.number().nonnegative().nullable().optional(),
  notes: z.string().trim().max(2000).optional(), placement_total: count,
  placements: z.array(z.object({house_id: z.uuid(), expected_revision: revision, starting_birds: count, batch_code: text, flock_code: text,
    transport_cost: z.number().nonnegative().optional(), other_cost: z.number().nonnegative().optional()})).min(1).max(100),
}).superRefine((value, ctx) => {
  if (new Set(value.placements.map(row => row.house_id)).size !== value.placements.length) ctx.addIssue({code: "custom", path: ["placements"], message: "DUPLICATE_HOUSE"});
  if (value.placements.reduce((sum, row) => sum + row.starting_birds, 0) !== value.placement_total) ctx.addIssue({code: "custom", path: ["placement_total"], message: "PLACEMENT_TOTAL_MISMATCH"});
});
export const closeCycleSchema = z.object({
  cycle_id: z.uuid(), mode: z.enum(["close", "legacy_attestation"]), completed_at: z.iso.datetime({offset: true}), expected_revision: revision,
  supporting_reference: z.string().trim().min(3).max(1000).optional(), dispositions: z.array(departure).max(500),
}).superRefine((value, ctx) => {
  if (value.mode === "legacy_attestation" && (!value.supporting_reference || value.dispositions.length)) ctx.addIssue({code: "custom", path: ["supporting_reference"], message: "LEGACY_EMPTY_HOUSE_EVIDENCE_REQUIRED"});
});
export type CycleCreate = z.infer<typeof createCycleSchema>;
export type CycleClose = z.infer<typeof closeCycleSchema>;
export const archivedBirdFields = ["opening_birds", "deaths", "culls", "transfers_in", "transfers_out", "other_removals", "closing_birds"] as const;
const birdNumber = z.number().int().min(0).max(2147483647);
export const archivedCycleCorrectionSchema = z.object({
  cycle_id: z.uuid(), expected_revision: revision,
  supporting_reference: z.string().trim().min(3).max(1000),
  records: z.array(z.object({id: z.uuid(), opening_birds: birdNumber, deaths: birdNumber, culls: birdNumber,
    transfers_in: birdNumber, transfers_out: birdNumber, other_removals: birdNumber, closing_birds: birdNumber}).strict()).min(1).max(500),
  loss_events: z.array(z.object({id: z.uuid(), record_id: z.uuid(), kind: z.enum(["death", "cull"]), count: birdNumber,
    explanation: z.string().trim().min(3).max(1000)}).strict()).max(1000).optional(),
  departures: z.array(departure).max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.records.map(row => row.id)).size !== value.records.length) ctx.addIssue({code: "custom", path: ["records"], message: "DUPLICATE_RECORD"});
  for (const [index, row] of value.records.entries()) if (row.closing_birds !== row.opening_birds + row.transfers_in - row.deaths - row.culls - row.transfers_out - row.other_removals)
    ctx.addIssue({code: "custom", path: ["records", index, "closing_birds"], message: "BIRD_BALANCE_MISMATCH"});
  if (value.loss_events) {
    if (new Set(value.loss_events.map(row => row.id)).size !== value.loss_events.length) ctx.addIssue({code: "custom", path: ["loss_events"], message: "DUPLICATE_EVENT"});
    for (const event of value.loss_events) if (!value.records.some(row => row.id === event.record_id)) ctx.addIssue({code: "custom", path: ["loss_events"], message: "UNREVIEWED_RECORD"});
    for (const row of value.records) for (const [kind, field] of [["death", "deaths"], ["cull", "culls"]] as const)
      if (value.loss_events.filter(e => e.record_id === row.id && e.kind === kind).reduce((sum, e) => sum + e.count, 0) !== row[field]) ctx.addIssue({code: "custom", path: ["loss_events"], message: "LOSS_EVIDENCE_MISMATCH"});
  }
});
export type ArchivedCycleCorrection = z.infer<typeof archivedCycleCorrectionSchema>;
export type ArchivedCorrectionContext = {
  cycle: {id: string; code: string; farmId: string; revision: string};
  records: Array<{id: string; date: string; flock: string; house: string; final: boolean}
    & Record<(typeof archivedBirdFields)[number], number | null>>;
  lossEvents: Array<{id: string; record_id: string; kind: "death" | "cull"; count: number; explanation: string}>;
  departures: z.infer<typeof departure>[];
  sales: Array<{id: string; label: string; revision: string; headCount: number | null; unit: string}>;
  members: Array<{id: string; label: string}>;
};
export const wholeFlockMoveSchema = z.object({
  flock_id: z.uuid(), from_house_id: z.uuid(), farm_id: z.uuid(), house_id: z.uuid(),
  bird_count: count, moved_at: z.iso.datetime({offset: true}),
  expected_revision: revision, destination_revision: revision,
}).refine(value => value.from_house_id !== value.house_id, {path: ["house_id"], message: "DIFFERENT_HOUSE_REQUIRED"});
export type MovementContext = {flock: {id: string; code: string; farmId: string; houseId: string; birds: number; revision: string; eligible: boolean}};
export type CycleContext = {
  farm: {id: string; name: string}; day: string;
  cycles: Array<{id: string; code: string; status: string; completionVerified: boolean}>;
  cycle: null | {id: string; code: string; status: string; legacy: boolean; completionVerified: boolean; revision: string};
  houses: Array<{id: string; name: string; eligible: boolean; blocker: "OCCUPIED" | "COMPLETION_UNVERIFIED" | null; revision: string}>;
  members: Array<{id: string; code: string; house: string; batch: string; currentBirds: number; finalRecord: boolean; feedClosed: boolean; healthConfirmed: boolean; suppliesConfirmed: boolean; balanced: boolean; finalValues: null | {date: string; opening: number | null; deaths: number | null; culls: number | null; otherRemovals: number; closing: number | null}}>;
  sales: Array<{id: string; label: string; date: string; unit: string; quantity: number; headCount: number | null; allocated: number; revision: string}>;
  breeds: Array<{id: string; name: string}>;
};
