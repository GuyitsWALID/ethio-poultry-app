import "server-only";
import {canAccessFarm, governanceAdmin, type AccessContext} from "@/lib/access-context";
import type {GovernanceInput} from "@/lib/governance-workflow";
import {eggSaleSourcesSchema} from "./egg-sale-sources";

export async function eggSourceOptions(ctx: AccessContext, farmId: string, date: string) {
  if (!await canAccessFarm(ctx, farmId)) throw new Error("EGG_SOURCE_ACCESS_DENIED");
  const {data, error} = await governanceAdmin.from("flocks").select("id,flock_code,house_id,batch_id")
    .eq("org_id", ctx.orgId).eq("farm_id", farmId).in("flock_type", ["layer", "parent_stock"]).lte("placement_date", date).order("flock_code");
  if (error) throw error;
  return data ?? [];
}

export async function prepareEggSourceCorrection(ctx: AccessContext, input: GovernanceInput): Promise<GovernanceInput> {
  if (ctx.role !== "farm_manager" || input.source_table !== "daily_sales_records" || !input.source_id) throw new Error("EGG_SOURCE_ACCESS_DENIED");
  const sale = await governanceAdmin.from("daily_sales_records").select("*").eq("org_id", ctx.orgId).eq("id", input.source_id).is("voided_at", null).maybeSingle();
  if (sale.error) throw sale.error;
  if (!sale.data || sale.data.product_category !== "egg" || !sale.data.farm_id || sale.data.farm_id !== input.farm_id
    || !await canAccessFarm(ctx, sale.data.farm_id)) throw new Error("EGG_SOURCE_ACCESS_DENIED");
  if (input.finding_id) {
    const finding = await governanceAdmin.from("reconciliation_findings").select("farm_id,evidence,status").eq("org_id",ctx.orgId).eq("id",input.finding_id).maybeSingle();
    const evidence = finding.data?.evidence as {saleId?: string; saleIds?: string[]} | null;
    if (finding.error || !finding.data || finding.data.farm_id !== sale.data.farm_id
      || ["resolved","cleared","accepted_exception"].includes(finding.data.status)
      || !(evidence?.saleId === sale.data.id || evidence?.saleIds?.includes(sale.data.id))) throw new Error("EGG_SOURCE_ACCESS_DENIED");
  }
  let value = input.proposed_values?.egg_sources;
  if (typeof value === "string") {try {value = JSON.parse(value);} catch {throw new Error("EGG_SOURCE_INVALID");}}
  const sources = eggSaleSourcesSchema.safeParse(value);
  if (!sources.success) throw new Error("EGG_SOURCE_INVALID");
  const {data, error} = await governanceAdmin.rpc("egg_sale_source_evidence", {
    p_org: ctx.orgId, p_farm: sale.data.farm_id, p_date: sale.data.sale_date,
    p_quantity: sale.data.quantity, p_unit: sale.data.unit, p_sources: sources.data,
    p_multiplier: sale.data.egg_conversion_multiplier ?? null,
  });
  if (error) throw new Error(error.message);
  const revision = await governanceAdmin.rpc("lifecycle_sale_revision", {p_org: ctx.orgId, p_sale: sale.data.id});
  if (revision.error || !revision.data) throw new Error("EGG_SOURCE_LOAD_FAILED");
  return {...input, source_version: sale.data.updated_at, changed_fields: ["egg_sources"], proposed_values: {egg_sources: data, sale_date: sale.data.sale_date, sale_revision: revision.data}};
}
