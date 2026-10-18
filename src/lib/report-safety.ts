// Pure reporting guards shared by server readers and browser exports.
export function validReportDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function reportTimestampBounds(from: string, to: string) {
  if (!validReportDate(from) || !validReportDate(to) || from > to) throw new Error("INVALID_REPORT_PERIOD");
  const start = Date.parse(`${from}T00:00:00+03:00`);
  const end = Date.parse(`${to}T00:00:00+03:00`) + 86400000;
  if ((end - start) / 86400000 > 366) throw new Error("REPORT_PERIOD_TOO_LONG");
  return {start: new Date(start).toISOString(), end: new Date(end).toISOString()};
}

export function reportOperatingDate(timestamp: string): string | null {
  const instant = Date.parse(timestamp);
  return Number.isFinite(instant) ? new Date(instant + 3 * 3600000).toISOString().slice(0, 10) : null;
}

export function reportWarehouseAllowed(warehouseId: unknown, allowed: ReadonlySet<string> | null): boolean {
  return allowed === null || typeof warehouseId === "string" && allowed.has(warehouseId);
}

export function reportCsvCell(value: unknown): string {
  let text = String(value ?? "Unavailable");
  // Quoting alone does not prevent spreadsheet formula execution.
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportConsumptionCost(rows: readonly Record<string, unknown>[]): number | null {
  const consumption = rows.filter(row => row.transaction_type === "issue" || row.transaction_type === "return");
  if (!consumption.length) return null;
  let total = 0;
  for (const row of consumption) {
    const numeric = (value: unknown) => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value));
    if (!numeric(row.quantity) || !numeric(row.unit_cost) || Number(row.unit_cost) < 0) return null;
    total += Math.abs(Number(row.quantity)) * Number(row.unit_cost) * (row.transaction_type === "return" ? -1 : 1);
  }
  return total;
}
