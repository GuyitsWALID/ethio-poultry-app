export type PageFilterValues = Record<string, string>;

const PREFIX = "filter_";
const targetKeys = ["finding", "flock", "batch", "record", "record_id", "source_id", "approval", "authorization", "request"];

export function pageFilterStorageKey(orgId: string, userId: string, pathname: string) {
  return `page-filters:v2:${orgId}:${userId}:${pathname}`;
}

export function readPageFilters(search: string, saved: string | null): PageFilterValues {
  const params = new URLSearchParams(search);
  // Explicit links and record destinations always take precedence over device memory.
  const explicit = [...params.keys()].some(key => key.startsWith(PREFIX));
  if (explicit) return Object.fromEntries([...params].filter(([key]) => key.startsWith(PREFIX)).map(([key, value]) => [key.slice(PREFIX.length), value]));
  if (targetKeys.some(key => params.has(key))) return {};
  try {
    const parsed: unknown = JSON.parse(saved ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch { return {}; }
}

export function writePageFilters(search: string, values: PageFilterValues) {
  const params = new URLSearchParams(search);
  for (const key of [...params.keys()]) if (key.startsWith(PREFIX)) params.delete(key);
  // Keep an explicit marker so a reset/shared unfiltered URL cannot restore old filters.
  params.set(`${PREFIX}view`, "1");
  for (const [key, value] of Object.entries(values)) if (key !== "view") params.set(`${PREFIX}${key}`, value);
  return params.toString();
}
