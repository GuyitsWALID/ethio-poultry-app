import {getTranslations} from "next-intl/server";
import { feedJson, getFeedContext } from "@/lib/feed-control";
import {FarmOperationError, farmOperationErrorBody, saveFeedSession, voidFeedSession} from "@/lib/farm-operations";

export async function POST(request: Request) {
  const validation = await getTranslations("OperationValidation");
  const ctx = await getFeedContext();
  if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: validation("onlyAnOperationsManagerCanRecordFeedingSessions") }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try { return feedJson({session: await saveFeedSession(ctx, body)}); }
  catch (error) { return error instanceof FarmOperationError ? feedJson(await farmOperationErrorBody(error),error.status) : feedJson({error:error instanceof Error?error.message:"Unknown error"},500); }
}

export async function DELETE(request: Request) {
  const validation = await getTranslations("OperationValidation");
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: validation("onlyAnOperationsManagerCanRemoveFeedingSessions") }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try { await voidFeedSession(ctx, body); return feedJson({voided:true}); }
  catch (error) { return error instanceof FarmOperationError ? feedJson(await farmOperationErrorBody(error),error.status) : feedJson({error:error instanceof Error?error.message:"Unknown error"},500); }
}
