import { NextRequest } from "next/server";

import { getSalesContext, json, supabaseAdmin } from "@/lib/sales";
import type { Json } from "@/types/supabase";

type DailyRecordResult = {
  daily_record_id: string;
  usage_count: number;
};

function cleanId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function errorStatus(code: string | undefined) {
  if (code === "42501") return 403;
  if (code === "22023" || code === "22P02" || code === "23505" || code === "23514") return 400;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (ctx.role !== "farm_manager") {
      return json({ error: "Only farm managers can save daily records and inventory usage." }, 403);
    }

    const body = await request.json();
    const flockId = cleanId(body.flock_id);
    const dailyRecordId = cleanId(body.daily_record_id);
    const record = body.record;
    const usages = body.usages;

    if (!flockId) return json({ error: "Flock is required." }, 400);
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return json({ error: "Daily record payload is required." }, 400);
    }
    if (!Array.isArray(usages)) return json({ error: "Inventory usages must be an array." }, 400);

    const { data, error } = await supabaseAdmin.rpc("save_daily_record_with_usage", {
      p_actor_id: ctx.userId,
      p_daily_record_id: dailyRecordId,
      p_flock_id: flockId,
      p_record: record as Json,
      p_usages: usages as Json,
    });

    if (error) return json({ error: error.message }, errorStatus(error.code));
    return json({ result: data as DailyRecordResult }, dailyRecordId ? 200 : 201);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
