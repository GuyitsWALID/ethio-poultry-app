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
  priorDailyRecordId: "Previous Daily Record",
  currentDailyRecordId: "Current Daily Record",
  flockId: "Flock",
  flockIds: "Flocks",
  farmId: "Farm",
  houseId: "House",
  batchId: "Batch",
  warehouseId: "Warehouse",
  itemId: "Inventory item",
  closureId: "Feeding day",
  physicalCountId: "Physical stock count",
  periodId: "Financial period",
  saleId: "Sale record",
  saleIds: "Sale records",
  movementIds: "Inventory movements",
  houseFarmId: "House belongs to farm",
  batchFarmId: "Batch belongs to farm",
  batchHouseId: "Batch belongs to house",
  recordedBy: "Recorded by reference",
  countedBy: "Counted by reference",
  entryDate: "Entry date",
  supplierName: "Supplier",
  invoiceNumber: "Invoice number",
  flockCode: "Flock",
  farmName: "Farm",
  farmRecordFound: "Farm record found",
  houseRecordFound: "House record found",
  houseMatchesFarm: "House belongs to this farm",
  batchRecordFound: "Batch record found",
  batchMatchesFarm: "Batch belongs to this farm",
  batchMatchesHouse: "Batch belongs to this house",
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

export type EvidenceDisplayContext = {
  flockCode?: string | null;
  farmName?: string | null;
  houseName?: string | null;
  warehouseName?: string | null;
  recordDate?: string | null;
  resolveId?: (id: string) => string | null;
};

function contextualRecordName(key: string, evidence: Record<string, unknown>, context: EvidenceDisplayContext) {
  const scope = context.flockCode ?? context.warehouseName ?? context.farmName ?? "affected operation";
  const date = context.recordDate ? ` · ${context.recordDate}` : "";
  if (/dailyRecordId$/i.test(key)) return `Daily Record · ${scope}${date}`;
  if (key === "closureId") return `Feed close · ${scope}${date}`;
  if (key === "physicalCountId") return `Physical stock count · ${scope}${date}`;
  if (key === "periodId") return `Financial period${date}`;
  if (key === "saleId") return `Sale record${date}`;
  if (key === "costEntryId") return `Cost record · ${String(evidence.invoiceNumber ?? evidence.description ?? context.farmName ?? "selected expense")}`;
  return `Related ${key.replace(/Ids?$/i, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()} record`;
}

export function userFacingReconciliationEvidence(evidence: unknown, context: EvidenceDisplayContext = {}): EvidenceEntry[] {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return [];
  const source = evidence as Record<string, unknown>;
  return reconciliationEvidenceEntries(evidence).map((entry) => {
    if (!entry.technical) {
      if (entry.key === "sourceKey") return { ...entry, label: "Linked feed day", value: `Feed Control · ${context.flockCode ?? "affected flock"}${context.recordDate ? ` · ${context.recordDate}` : ""}` };
      return entry;
    }
    const original = source[entry.key];
    if (Array.isArray(original)) {
      const names = original.map((id) => context.resolveId?.(String(id))).filter((name): name is string => Boolean(name));
      return { ...entry, technical: false, value: names.length === original.length ? names.join(", ") : `${original.length} related record${original.length === 1 ? "" : "s"}` };
    }
    const resolved = context.resolveId?.(String(original));
    return { ...entry, technical: false, value: resolved ?? contextualRecordName(entry.key, source, context) };
  });
}
