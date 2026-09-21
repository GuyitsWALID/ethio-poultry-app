import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {executeTodayCommand} from "@/lib/today-workspace/commands";

const headers = {"Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", Vary: "Cookie, Authorization"};

function statusFor(result: Awaited<ReturnType<typeof executeTodayCommand>>) {
  if (result.status === "applied") return 200;
  if (result.status === "conflict") return 409;
  if (result.error_code === "AUTH_REQUIRED") return 401;
  if (result.error_code === "ROLE_NOT_ALLOWED" || result.error_code === "ASSIGNMENT_REQUIRED") return 403;
  if (result.error_code === "OPERATING_DAY_LOCKED") return 423;
  if (result.error_code === "SOURCE_NOT_FOUND") return 404;
  if (result.error_code === "INTERNAL_ERROR") return 500;
  return 400;
}

export async function POST(request: Request) {
  const context = await getAccessContext({tenant: true});
  if (isAccessResponse(context)) return context;
  const result = await executeTodayCommand(context, await request.json().catch(() => null));
  return Response.json(result, {status: statusFor(result), headers});
}
