import { NextRequest } from "next/server";

import { hasManualFeedInput } from "@/lib/daily-record-input";
import { getSalesContext, json, supabaseAdmin } from "@/lib/sales";
import type { Json } from "@/types/supabase";

type DailyRecordResult = {
  daily_record_id: string;
  usage_count: number | null;
  usage_preserved: boolean;
};

function cleanId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function errorStatus(code: string | undefined) {
  if (code === "42501") return 403;
  if (code === "55000") return 409;
  if (code === "22023" || code === "22P02" || code === "23505" || code === "23514") return 400;
  return 500;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canMutate) {
      return json({ error: "Only farm managers can save daily records and inventory usage." }, 403);
    }

    const body = await request.json();
    const flockId = cleanId(body.flock_id);
    const dailyRecordId = cleanId(body.daily_record_id);
    const record = body.record;
    const usages = body.usages ?? null;

    if (!flockId) return json({ error: "Flock is required." }, 400);
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return json({ error: "Daily record payload is required." }, 400);
    }
    if (hasManualFeedInput(record as Record<string, unknown>)) {
      return json({ error: "Record feed intake and feed type in Today’s Feeding, then close the feeding day." }, 400);
    }
    if (usages !== null && !Array.isArray(usages)) {
      return json({ error: "Inventory usages must be an array or null." }, 400);
    }

    const { data, error } = await supabaseAdmin.rpc("save_daily_record_with_usage", {
      p_actor_id: ctx.userId,
      p_daily_record_id: dailyRecordId,
      p_flock_id: flockId,
      p_record: record as Json,
      p_usages: usages as Json,
    });

    if (error) {
      if (/operating day is locked/i.test(error.message)) {
        const { data: flock } = await supabaseAdmin.from("flocks").select("farm_id,flock_code").eq("id", flockId).eq("org_id", ctx.orgId).maybeSingle();
        const correctionFields = new Set(["normal_eggs", "broken_eggs", "dirty_eggs", "average_egg_weight_g", "deaths", "deaths_cause", "opening_birds", "closing_birds", "culls", "transfers_in", "transfers_out", "other_removals", "water_consumed_liters", "feed_leftover_grams", "vaccination_status", "medication_vitamins"]);
        const proposed = Object.fromEntries(Object.entries(record as Record<string, unknown>).filter(([key]) => correctionFields.has(key)));
        if (!dailyRecordId) Object.assign(proposed, { flock_id: flockId, record_date: (record as Record<string, unknown>).record_date });
        return json({
          error: "This Daily Record is locked. Request approval for this exact correction.",
          governance: {
            request_type: "locked_correction",
            farm_id: flock?.farm_id ?? null,
            source_table: "daily_farm_records",
            source_id: dailyRecordId,
            reason: `Correct the locked Daily Record for ${String((record as Record<string, unknown>).record_date ?? "the selected date")}.`,
            proposed_values: proposed,
            changed_fields: Object.keys(proposed),
            destination: `${flock?.flock_code ?? "Flock"} Daily Record · ${String((record as Record<string, unknown>).record_date ?? "selected date")}`,
            correction_route: `/app/daily-records${dailyRecordId ? `?record=${dailyRecordId}` : ""}`,
          },
        }, 423);
      }
      return json({ error: error.message }, errorStatus(error.code));
    }
    return json({ result: data as DailyRecordResult }, dailyRecordId ? 200 : 201);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
