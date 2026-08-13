type FindingRow = Record<string, unknown>;

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeReconciliationFinding<T extends FindingRow>(row: T) {
  const unit = row.variance_unit ?? row.unit;
  return {
    ...row,
    variance_value: finiteNumber(row.variance_value ?? row.variance),
    variance_unit: typeof unit === "string" && unit.trim() ? unit : null,
    estimated_impact_etb: finiteNumber(row.estimated_impact_etb),
  };
}

export function formatReconciliationNumber(
  value: unknown,
  unit = "",
  unavailable = "Evidence gap",
): string {
  const numeric = finiteNumber(value);
  if (numeric === null) return unavailable;
  return `${numeric.toLocaleString()}${unit ? ` ${unit}` : ""}`;
}

const evidenceLabels: Record<string, string> = {
  amountEtb: "Cost amount",
  allocatedEtb: "Allocated amount",
  allocationMethod: "Allocation method",
  costEntryId: "Cost entry reference",
  dailyRecordId: "Daily Record reference",
  recordedBy: "Recorded by reference",
  countedBy: "Counted by reference",
  entryDate: "Entry date",
  supplierName: "Supplier",
  invoiceNumber: "Invoice number",
};

export type EvidenceEntry = { key: string; label: string; value: string; technical: boolean };

export function reconciliationEvidenceEntries(evidence: unknown): EvidenceEntry[] {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return [];
  return Object.entries(evidence as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const technical = /(?:Id|Ids|By)$/.test(key);
      const label = evidenceLabels[key] ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
      const formatted = key.endsWith("Etb")
        ? formatReconciliationNumber(value, "ETB", "Unavailable")
        : Array.isArray(value)
          ? value.map(item => String(item)).join(", ")
          : typeof value === "boolean"
            ? value ? "Yes" : "No"
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value).replaceAll("_", " ");
      return { key, label, value: formatted, technical };
    });
}
