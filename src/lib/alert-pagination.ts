type Page<T> = {data: T[] | null; error: {message: string} | null};

// Never turn a failed or truncated source scan into evidence of resolution.
export async function allAlertRows<T>(read: (from: number, to: number) => PromiseLike<Page<T>>,
  pageSize = 500, maximum = 10000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from <= maximum; from += pageSize) {
    const result = await read(from, Math.min(from + pageSize - 1, maximum));
    if (result.error) throw new Error("Alerts could not check all source records. Refresh and try again.");
    const page = result.data ?? [];
    if (rows.length + page.length > maximum) throw new Error("Alerts source limit reached. Ask support to review the workload; no problems were marked fixed.");
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  throw new Error("Alerts source limit reached. No problems were marked fixed.");
}

export type ActionCursor = {priority: number; dueAt: string; id: string};
export function actionReadFilter(scope: {farms: Set<string> | null; warehouses: Set<string> | null}, cursor?: ActionCursor) {
  const terms: string[] = [];
  if (scope.farms !== null) {
    const alternatives: string[] = [];
    if (scope.farms.size) alternatives.push(`farm_id.in.(${[...scope.farms].join(",")})`);
    if (scope.warehouses?.size) alternatives.push(`warehouse_id.in.(${[...scope.warehouses].join(",")})`);
    terms.push(alternatives.length ? `or(${alternatives.join(",")})` : "id.eq.00000000-0000-0000-0000-000000000000");
  }
  if (cursor) terms.push(`or(inbox_priority.gt.${cursor.priority},and(inbox_priority.eq.${cursor.priority},or(due_at.gt.${cursor.dueAt},and(due_at.eq.${cursor.dueAt},id.gt.${cursor.id}))))`);
  return terms.length ? `and(${terms.join(",")})` : null;
}
