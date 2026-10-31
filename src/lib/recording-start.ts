import "server-only";
import {governanceAdmin, type AccessContext} from "@/lib/access-context";
import type {GovernanceInput} from "@/lib/governance-workflow";
import {validateRecordingStart, type RecordingStartContext} from "./recording-start-contract";
import {addisOperatingDate} from "@/lib/flock-lifecycle/server";

export async function prepareRecordingStart(ctx: AccessContext, input: GovernanceInput): Promise<GovernanceInput> {
  const proposed = input.proposed_values ?? {};
  const result = await governanceAdmin.rpc("recording_start_context", {p_actor: ctx.userId, p_flock: proposed.flock_id});
  if (result.error) throw new Error(result.error.message);
  const context = result.data as RecordingStartContext & {farm_id: string};
  const value = validateRecordingStart(proposed, context, addisOperatingDate(new Date()));
  if (input.farm_id !== context.farm_id) throw new Error("START_SCOPE_CHANGED");
  if (input.finding_id) {
    const finding = await governanceAdmin.from("reconciliation_findings").select("farm_id,flock_id,rule_code,status")
      .eq("id", input.finding_id).eq("org_id", ctx.orgId).maybeSingle();
    if (finding.error) throw finding.error;
    if (!finding.data || finding.data.farm_id !== context.farm_id || finding.data.flock_id !== value.flock_id
      || ["cleared", "resolved", "accepted_exception"].includes(finding.data.status)
      || !["EGG_OPENING_BALANCE_UNAVAILABLE", "BIRD_DAY_COUNTS_MISSING", "FLOCK_CURRENT_COUNT_MISMATCH"].includes(finding.data.rule_code)) throw new Error("START_SCOPE_CHANGED");
  }
  const correction = new URLSearchParams({farm_id: context.farm_id, flock_id: value.flock_id, date: value.effective_date, task: "birds"});
  if (input.finding_id) correction.set("finding", input.finding_id);
  return {
    ...input, source_table: "flocks", source_id: value.flock_id, source_version: context.updated_at,
    changed_fields: ["effective_date", "live_birds", ...(value.opening_eggs !== null ? ["opening_eggs"] : []), "supporting_reference"],
    proposed_values: {...value, expected_revision: context.expected_revision, previous_live_birds: context.current_birds},
    correction_route: `/app/today?${correction.toString()}`,
  };
}
