import type { DailySalesRecord } from "@/lib/sales";

export type CostBasisStatus = "locked" | "rolling_estimate" | "missing";
export type SalesTier = "premium_profit" | "standard_margin" | "break_even" | "loss_leader" | "unknown";

export type EggCostBasis = {
  status: CostBasisStatus;
  baseCostPerEgg: number | null;
  targetMarginPerEgg: number;
  targetPricePerEgg: number | null;
  normalEggs: number;
  brokenEggs: number;
  absorbedCost: number;
  sourceLabel: string;
  missingCostReasons: string[];
};

export type SalesTierSummary = {
  tier: SalesTier;
  label: string;
  revenue: number;
  eggsSold: number;
  marginPerEgg: number | null;
  totalTierProfit: number | null;
};

export function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function eggUnitsSold(record: Pick<DailySalesRecord, "quantity" | "unit">) {
  const unit = record.unit.toLowerCase();
  if (unit.includes("tray")) return record.quantity * 30;
  if (unit.includes("crate")) return record.quantity * 360;
  if (unit.includes("dozen")) return record.quantity * 12;
  return record.quantity;
}

export function unitPricePerEgg(record: Pick<DailySalesRecord, "unit_price" | "unit">) {
  const unit = record.unit.toLowerCase();
  if (unit.includes("tray")) return record.unit_price / 30;
  if (unit.includes("crate")) return record.unit_price / 360;
  if (unit.includes("dozen")) return record.unit_price / 12;
  return record.unit_price;
}

export function classifyEggSale(pricePerEgg: number, basis: EggCostBasis): SalesTier {
  if (!basis.baseCostPerEgg) return "unknown";
  const margin = pricePerEgg - basis.baseCostPerEgg;
  const targetMargin = basis.targetMarginPerEgg || 1;
  if (margin < 0) return "loss_leader";
  if (Math.abs(margin) < 0.005) return "break_even";
  if (margin >= targetMargin) return "premium_profit";
  return "standard_margin";
}

export function tierLabel(tier: SalesTier) {
  if (tier === "premium_profit") return "Premium Profit";
  if (tier === "standard_margin") return "Standard Margin";
  if (tier === "break_even") return "Break-even";
  if (tier === "loss_leader") return "Loss Leader";
  return "Unknown";
}

export function buildTierSummary(records: DailySalesRecord[], basis: EggCostBasis): SalesTierSummary[] {
  const map = new Map<SalesTier, SalesTierSummary>();

  records
    .filter((record) => record.product_category === "egg")
    .forEach((record) => {
      const pricePerEgg = unitPricePerEgg(record);
      const tier = classifyEggSale(pricePerEgg, basis);
      const eggsSold = eggUnitsSold(record);
      const marginPerEgg = basis.baseCostPerEgg ? pricePerEgg - basis.baseCostPerEgg : null;
      const current = map.get(tier) ?? {
        tier,
        label: tierLabel(tier),
        revenue: 0,
        eggsSold: 0,
        marginPerEgg: null,
        totalTierProfit: null,
      };

      current.revenue += record.gross_amount;
      current.eggsSold += eggsSold;
      if (marginPerEgg !== null) {
        const existingProfit = current.totalTierProfit ?? 0;
        current.totalTierProfit = existingProfit + marginPerEgg * eggsSold;
        current.marginPerEgg = current.eggsSold > 0 ? current.totalTierProfit / current.eggsSold : null;
      }
      map.set(tier, current);
    });

  return Array.from(map.values()).map((row) => ({
    ...row,
    revenue: round(row.revenue),
    eggsSold: round(row.eggsSold),
    marginPerEgg: row.marginPerEgg === null ? null : round(row.marginPerEgg, 4),
    totalTierProfit: row.totalTierProfit === null ? null : round(row.totalTierProfit),
  }));
}

export function missingCostBasis(message = "Egg pricing guidance is unavailable because cost or normal egg totals are incomplete."): EggCostBasis {
  return {
    status: "missing",
    baseCostPerEgg: null,
    targetMarginPerEgg: 0,
    targetPricePerEgg: null,
    normalEggs: 0,
    brokenEggs: 0,
    absorbedCost: 0,
    sourceLabel: "Missing cost basis",
    missingCostReasons: [message],
  };
}
