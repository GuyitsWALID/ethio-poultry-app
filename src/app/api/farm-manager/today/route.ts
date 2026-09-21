import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {loadTodayWorkspace, TodayWorkspaceError} from "@/lib/today-workspace/workspace";

const headers = {"Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", Vary: "Cookie, Authorization"};
const json = (value: unknown, status = 200) => Response.json(value, {status, headers});

function addisToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function GET(request: Request) {
  const context = await getAccessContext({tenant: true});
  if (isAccessResponse(context)) return context;
  const url = new URL(request.url);
  const farmId = url.searchParams.get("farm_id")?.trim() ?? "";
  const workDate = url.searchParams.get("date")?.trim() || addisToday();
  if (!farmId) return json({error_code: "INVALID_PAYLOAD", error_params: {field: "farm_id"}}, 400);
  try {
    return json(await loadTodayWorkspace(context, {farmId, workDate}));
  } catch (error) {
    if (error instanceof TodayWorkspaceError) return json({error_code: error.code}, error.status);
    return json({error_code: "INTERNAL_ERROR"}, 500);
  }
}
