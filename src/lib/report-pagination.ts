type Page<T> = {data: T[] | null; error: {message: string} | null};

// Callers must supply a stable unique ordering. Never calculate a partial total.
export async function readReportQuery<T>(query: () => {range(from: number, to: number): PromiseLike<Page<T>>}, maximum = 100000) {
  const data: T[] = [];
  const pageSize = 500;
  for (let from = 0; from <= maximum; from += pageSize) {
    const result = await query().range(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    data.push(...page);
    if (data.length > maximum) throw new Error("REPORT_TOO_LARGE");
    if (page.length < pageSize) return {data, error: null};
  }
  throw new Error("REPORT_TOO_LARGE");
}
