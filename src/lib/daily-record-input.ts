export const FEED_CONTROLLED_RECORD_FIELDS = [
  "feed_intake_grams",
  "feed_intake_quantity",
  "feed_type",
] as const;

export function hasManualFeedInput(record: Record<string, unknown>) {
  return FEED_CONTROLLED_RECORD_FIELDS.some((field) => {
    const value = record[field];
    return value !== null && value !== undefined && value !== "";
  });
}

