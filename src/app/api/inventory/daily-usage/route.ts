import {getTranslations} from "next-intl/server";
import { NextRequest } from "next/server";

import {FarmOperationError, farmOperationErrorBody, saveDailyRecordWithUsage} from "@/lib/farm-operations";
import { getSalesContext, json } from "@/lib/sales";

export async function POST(request: NextRequest) {
  const validation = await getTranslations("OperationValidation");
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canMutate) {
      return json({ error: validation("onlyFarmManagersCanSaveDailyRecordsAnd") }, 403);
    }
    const body = await request.json();
    const operation = await saveDailyRecordWithUsage(ctx, body);
    return json({ result: operation.result }, operation.created ? 201 : 200);
  } catch (error: unknown) {
    if (error instanceof FarmOperationError) {
      return json(await farmOperationErrorBody(error), error.status);
    }
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
