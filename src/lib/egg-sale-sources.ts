import {z} from "zod";

export const eggSaleSourcesSchema = z.array(z.object({
  flock_id: z.string().uuid(),
  egg_quantity: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
})).min(1).max(100).refine(rows => new Set(rows.map(row => row.flock_id)).size === rows.length, "Choose each source flock once.");
export type EggSaleSource = {flock_id: string; flock?: string; house_id?: string; batch_id?: string | null; egg_quantity: number; multiplier?: number};

export function eggSaleSources(value: unknown): EggSaleSource[] {
  if (!Array.isArray(value)) return [];
  return value.map(row => {
    const parsed = eggSaleSourcesSchema.element.safeParse(row);
    if (!parsed.success) throw new Error("EGG_SALE_SOURCE_INVALID");
    return {...row, ...parsed.data} as EggSaleSource;
  });
}

// Cumulative cent rounding keeps combined-scope totals identical to the single
// financial record, including a last-cent remainder shared between flocks.
export function projectEggSale<T extends {quantity: number; gross_amount: number; paid_amount: number; balance_due: number; product_category: string; egg_sources?: unknown; egg_source_version?: number}>(sale: T): T[] {
  if (sale.product_category !== "egg" || !sale.egg_source_version) return [sale];
  const sources = eggSaleSources(sale.egg_sources);
  if (!sources.length) throw new Error("EGG_SALE_SOURCE_INVALID");
  const total = sources.reduce((sum, source) => sum + Number(source.egg_quantity), 0);
  const grossCents = Math.round(Number(sale.gross_amount)*100), paidCents = Math.round(Number(sale.paid_amount)*100);
  let used = 0, usedGross = 0;
  return sources.map(source => {
    const before = used / total; used += Number(source.egg_quantity); const after = used / total;
    const gross = Math.round(grossCents*after)-Math.round(grossCents*before);
    const paidBefore = grossCents ? Math.round(paidCents*usedGross/grossCents) : 0; usedGross += gross;
    const paid = grossCents ? Math.round(paidCents*usedGross/grossCents)-paidBefore : 0;
    return {...sale, flock_id: source.flock_id, house_id: source.house_id ?? null, batch_id: source.batch_id ?? null,
      egg_sources: [source], quantity: Number(sale.quantity) * Number(source.egg_quantity)/total,
      gross_amount: gross/100, paid_amount: paid/100, balance_due: (gross-paid)/100};
  });
}

export function projectEggSales<T extends Parameters<typeof projectEggSale>[0]>(sales: T[]): T[] {
  const count = sales.reduce((total,sale) => total + (sale.product_category === "egg" && sale.egg_source_version && Array.isArray(sale.egg_sources) ? sale.egg_sources.length : 1), 0);
  if (count > 100000) throw new Error("REPORT_TOO_LARGE");
  return sales.flatMap(sale => projectEggSale(sale));
}
