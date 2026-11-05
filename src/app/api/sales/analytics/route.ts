import {NextRequest} from "next/server";
import {getSalesContext, json} from "@/lib/sales";
import {loadSalesAnalytics} from "@/lib/sales-analytics-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    return await loadSalesAnalytics(ctx, request.nextUrl.searchParams);
  } catch {
    return json({error: "Sales analytics could not be loaded."}, 500);
  }
}
