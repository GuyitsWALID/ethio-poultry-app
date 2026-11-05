export type SavedReportCursor = {version: 1; actor: string; org: string; createdAt: string; id: string};
export type SavedReportSummary = {id: string; report_name: string; period_from: string; period_to: string;
  status: "completed" | "failed"; failure_message: string | null; generated_at: string | null; created_at: string};
export type SavedReportPage = {runs: SavedReportSummary[]; nextCursor: string | null};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readSavedReportCursor(value: string | null, actor: string, org: string): SavedReportCursor | null {
  if (!value) return null;
  try {
    if (value.length > 1000 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (cursor.version !== 1 || cursor.actor !== actor || cursor.org !== org || !uuid.test(cursor.id)
      || typeof cursor.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(cursor.createdAt)
      || !Number.isFinite(Date.parse(cursor.createdAt))) throw new Error();
    return cursor;
  } catch {throw new Error("Invalid saved-report cursor. Refresh the report list.");}
}

export function savedReportPage(rows: SavedReportSummary[], actor: string, org: string): SavedReportPage {
  const runs = rows.slice(0, 50), last = runs.at(-1);
  return {runs, nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify({version: 1, actor, org,
    createdAt: last.created_at, id: last.id} satisfies SavedReportCursor)).toString("base64url") : null};
}
