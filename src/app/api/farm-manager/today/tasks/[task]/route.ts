import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {loadTodayTaskDetail} from "@/lib/today-workspace/task-details";
import {TodayWorkspaceError} from "@/lib/today-workspace/workspace";

const headers = {"Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", Vary: "Cookie, Authorization"};
const json = (body: unknown, status = 200) => Response.json(body, {status, headers});

export async function GET(request: Request, context: RouteContext<"/api/farm-manager/today/tasks/[task]">) {
  const access = await getAccessContext({tenant: true});
  if (isAccessResponse(access)) return access;
  const {task} = await context.params;
  const url = new URL(request.url);
  try {
    return json(await loadTodayTaskDetail(access, {
      task,
      farmId: url.searchParams.get("farm_id")?.trim() ?? "",
      flockId: url.searchParams.get("flock_id")?.trim() || undefined,
      workDate: url.searchParams.get("date")?.trim() ?? "",
    }));
  } catch (error) {
    if (error instanceof TodayWorkspaceError) return json({error_code: error.code}, error.status);
    return json({error_code: "INTERNAL_ERROR"}, 500);
  }
}
