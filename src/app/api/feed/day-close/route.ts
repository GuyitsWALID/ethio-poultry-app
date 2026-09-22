import { feedJson, getFeedContext } from "@/lib/feed-control";
import {closeFeedDay, FarmOperationError, reopenFeedDay} from "@/lib/farm-operations";

export async function POST(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can close a feeding day." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try { return feedJson({result: await closeFeedDay(ctx, body)}); }
  catch (error) { return error instanceof FarmOperationError ? feedJson({error:error.message},error.status) : feedJson({error:error instanceof Error?error.message:"Unknown error"},500); }
}

export async function DELETE(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can reopen a feeding day." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try { return feedJson({result: await reopenFeedDay(ctx, body)}); }
  catch (error) { return error instanceof FarmOperationError ? feedJson({error:error.message},error.status) : feedJson({error:error instanceof Error?error.message:"Unknown error"},500); }
}
