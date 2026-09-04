import { NextRequest } from "next/server";

import { getAccessContext, isAccessResponse } from "@/lib/access-context";
import { loadOperationsAnalytics } from "@/lib/operations-analytics-service";

export async function GET(request: NextRequest) {
  const access = await getAccessContext({ tenant: true });
  if (isAccessResponse(access)) return access;
  return loadOperationsAnalytics(access, request.nextUrl.searchParams);
}
