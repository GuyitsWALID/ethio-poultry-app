import {formatOperationDate} from "../i18n/formats.ts";

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
  locale?: string,
): string {
  const numeric = finiteNumber(value);
  if (numeric === null) return unavailable;
  return `${numeric.toLocaleString(locale === "am" ? "am-ET" : locale === "en" ? "en-ET" : undefined)}${unit ? ` ${unit}` : ""}`;
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
  locale?: string;
  translate?: (key: string, values?: Record<string, string | number>) => string | undefined;
};

function contextualRecordName(key: string, evidence: Record<string, unknown>, context: EvidenceDisplayContext) {
  const say = (key: string, fallback: string, values?: Record<string, string | number>) => context.translate?.(key, values) ?? fallback;
  const scope = context.flockCode ?? context.warehouseName ?? context.farmName ?? say("operation", "affected operation");
  const date = context.recordDate ? ` · ${context.locale ? formatOperationDate(`${context.recordDate}T12:00:00Z`, context.locale === "am" ? "am" : "en") : context.recordDate}` : "";
  if (/dailyRecordId$/i.test(key)) return say("daily", `Daily Record · ${scope}${date}`, {scope, date});
  if (key === "closureId") return say("close", `Feed close · ${scope}${date}`, {scope, date});
  if (key === "physicalCountId") return say("physical", `Physical stock count · ${scope}${date}`, {scope, date});
  if (key === "periodId") return say("period", `Financial period${date}`, {date});
  if (key === "saleId") return say("sale", `Sale record${date}`, {date});
  if (key === "costEntryId") return say("cost", `Cost record · ${String(evidence.invoiceNumber ?? evidence.description ?? context.farmName ?? "selected expense")}`, {scope: String(evidence.invoiceNumber ?? evidence.description ?? context.farmName ?? say("expense", "selected expense"))});
  return say("related", `Related ${key.replace(/Ids?$/i, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()} record`);
}

export function userFacingReconciliationEvidence(evidence: unknown, context: EvidenceDisplayContext = {}): EvidenceEntry[] {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return [];
  const source = evidence as Record<string, unknown>;
  const say = (key: string, fallback: string, values?: Record<string, string | number>) => context.translate?.(key, values) ?? fallback;
  return reconciliationEvidenceEntries(evidence).map((originalEntry) => {
    const entry = {...originalEntry, label: say(`fields.${originalEntry.key}`, originalEntry.label)};
    if (!entry.technical) {
      if (entry.key === "sourceKey") {
        const scope = context.flockCode ?? say("flock", "affected flock");
        const date = context.recordDate ? ` · ${context.locale ? formatOperationDate(`${context.recordDate}T12:00:00Z`, context.locale === "am" ? "am" : "en") : context.recordDate}` : "";
        return {...entry, value: say("linkedFeed", `Feed Control · ${scope}${date}`, {scope, date})};
      }
      if (typeof source[entry.key] === "boolean") return {...entry, value: source[entry.key] ? say("yes", "Yes") : say("no", "No")};
      if (entry.key.endsWith("Etb")) return {...entry, value: formatReconciliationNumber(source[entry.key], "ETB", say("unavailable", "Unavailable"), context.locale)};
      if (entry.key === "entryDate" && typeof source[entry.key] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(source[entry.key])) && context.locale) return {...entry, value: formatOperationDate(`${source[entry.key]}T12:00:00Z`, context.locale === "am" ? "am" : "en")};
      return entry;
    }
    const original = source[entry.key];
    if (Array.isArray(original)) {
      const names = original.map((id) => context.resolveId?.(String(id))).filter((name): name is string => Boolean(name));
      return { ...entry, technical: false, value: names.length === original.length ? names.join(", ") : say("relatedCount", `${original.length} related record${original.length === 1 ? "" : "s"}`, {count: original.length}) };
    }
    const resolved = context.resolveId?.(String(original));
    return { ...entry, technical: false, value: resolved ?? contextualRecordName(entry.key, source, context) };
  });
}
