export const historyCategories = ["daily", "feeding", "losses", "health", "stock", "sales", "expenses", "closing"] as const;
export type HistoryCategory = typeof historyCategories[number];
export type HistoryRow = Record<string, unknown>;
export type HistoryInput = {category: HistoryCategory; subtype: string; from: string; to: string; farm: string; house: string; flock: string; batch: string; warehouse: string};
export type HistoryField = {key: string; value: string | number | null; format?: "date" | "datetime" | "number" | "money" | "code"; unit?: string};
export type HistoryItem = {kind: string; id: string; date: string; context: string; status: string; summary: HistoryField[]};
export type HistoryDetail = HistoryItem & {fields: HistoryField[]; supporting: Array<{kind: string; fields: HistoryField[]}>; correctionHref: string | null};
export type HistoryOption = {id: string; name: string; farmId?: string; houseId?: string; batchId?: string | null};
export type HistoryOptions = {farms: HistoryOption[]; houses: HistoryOption[]; flocks: HistoryOption[]; batches: HistoryOption[]; warehouses: HistoryOption[]};
export type HistoryPage = {items: HistoryItem[]; nextCursor: string | null; options: HistoryOptions};
export class HistoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {super(code); this.code = code; this.status = status;}
}
export const historyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function validHistoryDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function historyPeriod(days = 30, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const to = `${values.year}-${values.month}-${values.day}`, start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {from: start.toISOString().slice(0, 10), to};
}
export function parseHistoryInput(query: URLSearchParams): HistoryInput {
  const defaults = historyPeriod();
  const input = {category: query.get("category") ?? "daily", subtype: query.get("subtype") ?? "", from: query.get("from") ?? defaults.from, to: query.get("to") ?? defaults.to, ...Object.fromEntries(["farm", "house", "flock", "batch", "warehouse"].map(key => [key, query.get(`${key}_id`) ?? ""]))} as HistoryInput;
  if (!historyCategories.includes(input.category) || !validHistoryDate(input.from) || !validHistoryDate(input.to) || input.from > input.to) throw new HistoryError("INVALID_FILTERS");
  for (const key of ["farm", "house", "flock", "batch", "warehouse"] as const) if (input[key] && !historyUuid.test(input[key])) throw new HistoryError("INVALID_FILTERS");
  return input;
}
export type HistoryCursor = {v: 1; filter: string; date: string; kind: string; id: string};
export const historyFingerprint = (input: HistoryInput) => JSON.stringify([input.category, input.subtype, input.from, input.to, input.farm, input.house, input.flock, input.batch, input.warehouse]);
export function historyCursor(input: HistoryInput, item: Pick<HistoryItem, "date" | "kind" | "id">) {
  return btoa(JSON.stringify({v: 1, filter: historyFingerprint(input), date: item.date, kind: item.kind, id: item.id})).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export function parseHistoryCursor(value: string | null, input: HistoryInput, kinds: string[]): HistoryCursor | null {
  if (!value) return null;
  try {
    if (value.length > 3000 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error();
    const cursor = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/"))) as HistoryCursor;
    if (cursor.v !== 1 || cursor.filter !== historyFingerprint(input) || !validHistoryDate(cursor.date) || !historyUuid.test(cursor.id) || !kinds.includes(cursor.kind)) throw Error();
    return cursor;
  } catch {throw new HistoryError("INVALID_CURSOR");}
}
const descending = (left: string, right: string) => left === right ? 0 : left > right ? -1 : 1;
export function mergeHistoryPages(input: HistoryInput, pages: HistoryItem[][]) {
  const all = pages.flat().sort((a, b) => descending(a.date, b.date) || descending(a.kind, b.kind) || descending(a.id, b.id));
  const items = all.slice(0, 50);
  return {items, nextCursor: all.length > 50 ? historyCursor(input, items[49]) : null};
}
export function buildHistoryHref(values: Partial<HistoryInput> = {}, selected?: {kind: string; id: string}) {
  const query = new URLSearchParams({filter_view: "1"});
  for (const [key, value] of Object.entries(values)) if (value) query.set(`filter_page_history_${key}`, value);
  if (selected) {query.set("history_kind", selected.kind); query.set("history_record", selected.id);}
  return `/app/history?${query}`;
}
export function safeHistoryReturn(value: string | null | undefined) {
  if (!value || value.length > 6000) return null;
  try {
    const url = new URL(value, "https://history.invalid");
    if (!value.startsWith("/app/history") || url.origin !== "https://history.invalid" || url.pathname !== "/app/history" || url.hash) return null;
    const permitted = new Set(["filter_view", "history_kind", "history_record", ...["category", "subtype", "from", "to", "farm", "house", "flock", "batch", "warehouse"].map(key => `filter_page_history_${key}`)]);
    if ([...url.searchParams.keys()].some(key => !permitted.has(key))) return null;
    return `${url.pathname}${url.search}`;
  } catch {return null;}
}

export function historyCorrectionHref(href: string, returnTo: string) {
  const safe = safeHistoryReturn(returnTo);
  if (!safe) return null;
  const url = new URL(href, "https://history.invalid");
  if (url.origin !== "https://history.invalid" || url.pathname !== "/app/governance") return null;
  url.searchParams.set("history_return", safe);
  const correction = new URL(url.searchParams.get("correction_route") ?? "/app/governance", url.origin);
  if (correction.origin !== url.origin || !["/app/daily-records", "/app/feeding-log", "/app/sales", "/app/health", "/app/governance"].includes(correction.pathname)) return null;
  correction.searchParams.set("history_return", safe);
  url.searchParams.set("correction_route", `${correction.pathname}${correction.search}`);
  return `${url.pathname}${url.search}`;
}
