import {z} from "zod";

const operationalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const physicalCount = z.union([z.number(), z.string().trim().regex(/^\d+$/)]).transform(Number).pipe(z.number().int().nonnegative());
export const recordingStartInput = z.object({
  flock_id: z.string().uuid(),
  effective_date: operationalDate,
  live_birds: physicalCount,
  opening_eggs: physicalCount.nullable(),
  supporting_reference: z.string().trim().min(3).max(1000),
});

export type RecordingStartContext = {
  expected_revision: string; current_birds: number; initial_count: number;
  placement_date: string; last_record_date: string | null;
  existing_start: boolean; existing_egg_balance: boolean;
  flock_type: string; updated_at: string;
  last_record_closing_birds?: number | null;
};

export function validateRecordingStart(input: unknown, context: RecordingStartContext, today: string) {
  const value = recordingStartInput.parse(input);
  if (value.effective_date < context.placement_date || value.effective_date > today) throw new Error("START_DATE_INVALID");
  if (context.existing_start || context.existing_egg_balance) throw new Error("START_ALREADY_ESTABLISHED");
  if (context.last_record_date && value.effective_date <= context.last_record_date) throw new Error("START_HAS_RECORDS");
  const before = new Date(`${value.effective_date}T00:00:00Z`); before.setUTCDate(before.getUTCDate() - 1);
  if (context.last_record_date === before.toISOString().slice(0,10) && context.last_record_closing_birds != null) throw new Error("START_PREVIOUS_CLOSE_AVAILABLE");
  const layer = context.flock_type === "layer" || context.flock_type === "parent_stock";
  if (layer && value.opening_eggs === null) throw new Error("START_EGGS_REQUIRED");
  if (!layer && value.opening_eggs !== null) throw new Error("START_EGGS_NOT_APPLICABLE");
  return value;
}
