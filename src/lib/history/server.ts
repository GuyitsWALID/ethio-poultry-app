import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {governanceAdmin, type AccessContext} from "@/lib/access-context";
import {effectiveWarehouseIds} from "@/lib/warehouse-access";
import {HistoryError, historyUuid, mergeHistoryPages, parseHistoryCursor, type HistoryCursor, type HistoryDetail, type HistoryInput, type HistoryItem, type HistoryOption, type HistoryOptions, type HistoryRow} from "./contracts";
import {historyFields, historySources, sourceColumns, type HistorySource} from "./sources";

type Db = Pick<SupabaseClient, "from">;
type Scope = {farms: HistoryRow[]; houses: HistoryRow[]; flocks: HistoryRow[]; batches: HistoryRow[]; warehouses: HistoryRow[]; restricted: boolean};
const text = (value: unknown) => typeof value === "string" ? value : "";
const ids = (rows: HistoryRow[]) => rows.map(row => text(row.id));
async function all(read: (start: number, end: number) => PromiseLike<{data: unknown[] | null; error: unknown}>) {
  const result: HistoryRow[] = [];
  for (let start = 0; start < 20000; start += 500) {
    const {data, error} = await read(start, start + 499);
    if (error) throw new HistoryError("LOAD_FAILED", 503);
    result.push(...(data ?? []) as HistoryRow[]);
    if (!data || data.length < 500) return result;
  }
  throw new HistoryError("SCOPE_TOO_LARGE", 422);
}

export async function loadHistoryScope(ctx: AccessContext, db: Db = governanceAdmin, warehouseScope = effectiveWarehouseIds): Promise<Scope> {
  if (ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new HistoryError("ACCESS_DENIED", 403);
  const org = await db.from("organizations").select("today_workspace_enabled").eq("id", ctx.orgId).maybeSingle();
  if (org.error) throw new HistoryError("LOAD_FAILED", 503);
  if (!org.data?.today_workspace_enabled) throw new HistoryError("FEATURE_DISABLED", 403);
  const restricted = ctx.role === "farm_manager", now = new Date().toISOString();
  const assignments = restricted ? await all((start, end) => db.from("user_farm_access").select("id,farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).order("id").range(start, end)) : null;
  const farmIds = assignments?.map(row => text(row.farm_id));
  const farms = farmIds?.length === 0 ? [] : await all((start, end) => {
    let query = db.from("farms").select("id,name,branch_id").eq("org_id", ctx.orgId);
    if (farmIds) query = query.in("id", farmIds);
    return query.order("id").range(start, end);
  });
  const children = (table: string, columns: string) => !farms.length ? Promise.resolve([]) : all((start, end) => db.from(table).select(columns).eq("org_id", ctx.orgId).in("farm_id", ids(farms)).order("id").range(start, end));
  const warehouseIds = restricted ? await warehouseScope(ctx) : null;
  const [houses, flocks, batches, warehouses] = await Promise.all([
    children("houses", "id,name,farm_id"),
    children("flocks", "id,flock_code,farm_id,house_id,batch_id,status"),
    children("batches", "id,batch_code,farm_id,house_id,status,batch_cycle_id"),
    warehouseIds?.length === 0 ? Promise.resolve([]) : all((start, end) => {
      let query = db.from("warehouses").select("id,name,farm_id,status").eq("org_id", ctx.orgId);
      if (warehouseIds) query = query.in("id", warehouseIds).eq("status", "active");
      return query.order("id").range(start, end);
    }),
  ]);
  return {farms, houses, flocks, batches, warehouses, restricted};
}

export function selectHistoryScope(scope: Scope, input: HistoryInput) {
  for (const [key, rows] of [["farm", scope.farms], ["house", scope.houses], ["flock", scope.flocks], ["batch", scope.batches], ["warehouse", scope.warehouses]] as const) {
    if (input[key] && !rows.some(row => row.id === input[key])) throw new HistoryError("ACCESS_DENIED", 403);
  }
  const farms = scope.farms.filter(row => !input.farm || row.id === input.farm);
  const houses = scope.houses.filter(row => ids(farms).includes(text(row.farm_id)) && (!input.house || row.id === input.house));
  const batches = scope.batches.filter(row => ids(farms).includes(text(row.farm_id)) && (!input.house || row.house_id === input.house) && (!input.batch || row.id === input.batch));
  const flocks = scope.flocks.filter(row => ids(farms).includes(text(row.farm_id)) && ids(houses).includes(text(row.house_id)) && (!input.flock || row.id === input.flock) && (!input.batch || row.batch_id === input.batch));
  const warehouses = scope.warehouses.filter(row => (!input.warehouse || row.id === input.warehouse) && (!input.farm || !row.farm_id || row.farm_id === input.farm));
  if (input.house && !houses.length || input.batch && !batches.length || input.flock && !flocks.length || input.warehouse && !warehouses.length) throw new HistoryError("ACCESS_DENIED", 403);
  if (input.flock && input.batch && !flocks.some(row => row.batch_id === input.batch)) throw new HistoryError("ACCESS_DENIED", 403);
  if (["stock", "expenses"].includes(input.category)) {
    if (input.subtype === "physical_count" && (input.house || input.flock || input.batch)) throw new HistoryError("INVALID_FILTERS");
  } else if (input.warehouse) throw new HistoryError("INVALID_FILTERS");
  if (input.category === "closing" && (input.house || input.flock || input.batch)) throw new HistoryError("INVALID_FILTERS");
  return {...scope, farms, houses, flocks, batches, warehouses};
}

export function historyOptions(scope: Scope): HistoryOptions {
  const option = (row: HistoryRow, label: string): HistoryOption => ({id: text(row.id), name: text(row[label]), ...(row.farm_id ? {farmId: text(row.farm_id)} : {}), ...(row.house_id ? {houseId: text(row.house_id)} : {}), ...(row.batch_id ? {batchId: text(row.batch_id)} : {})});
  return {farms: scope.farms.map(row => option(row, "name")), houses: scope.houses.map(row => option(row, "name")), flocks: scope.flocks.map(row => option(row, "flock_code")), batches: scope.batches.map(row => option(row, "batch_code")), warehouses: scope.warehouses.map(row => option(row, "name"))};
}

function sourceQuery(db: Db, ctx: AccessContext, source: HistorySource, scope: Scope, input: HistoryInput) {
  let query = db.from(source.table).select(sourceColumns(source)).eq("org_id", ctx.orgId);
  if (source.voided) query = query.is("voided_at", null);
  if (source.scope === "flock") {
    if (!scope.flocks.length) return null;
    query = query.in("flock_id", ids(scope.flocks));
    // A farm grant never substitutes for explicit permission to a shared feed store.
    if (source.kind === "feed_session" && scope.restricted) query = query.or(`warehouse_id.is.null,warehouse_id.in.(${ids(scope.warehouses).join(",") || "00000000-0000-0000-0000-000000000000"})`);
  } else if (source.scope === "farm" || source.scope === "sale") {
    if (scope.restricted || input.farm) {
      if (!scope.farms.length) return null;
      query = query.in("farm_id", ids(scope.farms));
    }
    if (source.scope === "farm" && (input.house || input.flock || input.batch)) return null;
  } else if (source.scope === "warehouse") {
    if (!scope.warehouses.length) return null;
    query = query.in("warehouse_id", ids(scope.warehouses));
    if (input.farm) {
      if (source.kind === "physical_count") {
        const owned = scope.warehouses.filter(row => row.farm_id === input.farm);
        if (!owned.length) return null;
        query = query.in("warehouse_id", ids(owned));
      } else {
        const owned = ids(scope.warehouses.filter(row => row.farm_id === input.farm));
        query = query.or(`farm_id.eq.${input.farm},and(farm_id.is.null,warehouse_id.in.(${owned.join(",") || "00000000-0000-0000-0000-000000000000"}))`);
      }
    }
  } else {
    // Farm and warehouse restrictions are conjunctive when both are present.
    if (scope.restricted) {
      const farmIds = ids(scope.farms).join(",") || "00000000-0000-0000-0000-000000000000";
      const warehouseIds = ids(scope.warehouses).join(",") || "00000000-0000-0000-0000-000000000000";
      query = query.or(`and(farm_id.in.(${farmIds}),warehouse_id.is.null),and(warehouse_id.in.(${warehouseIds}),farm_id.is.null),and(farm_id.in.(${farmIds}),warehouse_id.in.(${warehouseIds}))`);
    }
    if (input.farm) query = query.eq("farm_id", input.farm);
    if (input.warehouse) query = query.eq("warehouse_id", input.warehouse);
  }
  if (["sale", "expense", "warehouse"].includes(source.scope)) {
    if (source.kind === "physical_count" && (input.house || input.flock || input.batch)) return null;
    for (const [column, value] of [["house_id", input.house], ["flock_id", input.flock], ["batch_id", input.batch]]) if (value) query = query.eq(column, value);
    if (input.warehouse && source.scope !== "warehouse" && source.scope !== "expense") return null;
  }
  if (source.predicate === "sessions") query = query.in("status", ["completed", "missed"]);
  if (source.predicate === "losses") query = query.or("deaths.gt.0,culls.gt.0");
  if (source.predicate === "health") query = query.in("event_type", ["disease", "treatment", "observation"]).or("description.is.null,description.not.like.SCHEDULE_%|%");
  if (source.predicate === "vaccination") query = query.like("description", "SCHEDULE_STATUS|%|completed|vaccination");
  if (source.predicate === "biosecurity") query = query.not("completed_by", "is", null);
  return query;
}

export function cursorQuery<T extends {lt: (field: string, value: string) => T; lte: (field: string, value: string) => T; or: (value: string) => T}>(query: T, source: HistorySource, cursor: HistoryCursor | null): T {
  if (!cursor) return query;
  if (source.kind === cursor.kind) return query.or(`${source.date}.lt.${cursor.date},and(${source.date}.eq.${cursor.date},id.lt.${cursor.id})`);
  return source.kind < cursor.kind ? query.lte(source.date, cursor.date) : query.lt(source.date, cursor.date);
}
const knownStatuses = new Set(["planned", "completed", "missed", "closed", "reopened", "open", "locked", "draft", "submitted", "reviewed"]);
function itemFor(source: HistorySource, row: HistoryRow, scope: Scope): HistoryItem {
  const flock = scope.flocks.find(value => value.id === row.flock_id), warehouse = scope.warehouses.find(value => value.id === row.warehouse_id);
  const farm = scope.farms.find(value => value.id === (row.farm_id ?? flock?.farm_id ?? warehouse?.farm_id));
  const house = scope.houses.find(value => value.id === (row.house_id ?? flock?.house_id));
  return {kind: source.kind, id: text(row.id), date: text(row[source.date]).slice(0, 10), context: [farm?.name, house?.name, flock?.flock_code, warehouse?.name].filter(Boolean).join(" · "), status: knownStatuses.has(text(row.status)) ? text(row.status) : "recorded", summary: historyFields(source, row).filter(field => field.value !== null && field.value !== "").slice(0, 2)};
}

export async function listHistory(ctx: AccessContext, input: HistoryInput, cursorValue: string | null, db: Db = governanceAdmin, warehouseScope = effectiveWarehouseIds) {
  const sources = historySources.filter(source => source.category === input.category && (!input.subtype || source.kind === input.subtype));
  if (!sources.length) throw new HistoryError("INVALID_FILTERS");
  const cursor = parseHistoryCursor(cursorValue, input, sources.map(source => source.kind));
  const fullScope = await loadHistoryScope(ctx, db, warehouseScope), scope = selectHistoryScope(fullScope, input);
  const pages = await Promise.all(sources.map(async source => {
    const query = sourceQuery(db, ctx, source, scope, input);
    if (!query) return [];
    const {data, error} = await cursorQuery(query.gte(source.date, input.from).lte(source.date, input.to), source, cursor).order(source.date, {ascending: false}).order("id", {ascending: false}).limit(51);
    if (error) throw new HistoryError("LOAD_FAILED", 503);
    return ((data ?? []) as unknown as HistoryRow[]).map(row => itemFor(source, row, fullScope));
  }));
  return {...mergeHistoryPages(input, pages), options: historyOptions(fullScope)};
}

export async function historyDetail(ctx: AccessContext, kind: string, id: string, db: Db = governanceAdmin, warehouseScope = effectiveWarehouseIds): Promise<HistoryDetail> {
  const source = historySources.find(value => value.kind === kind);
  if (!source || !historyUuid.test(id)) throw new HistoryError("UNAVAILABLE", 404);
  const scope = await loadHistoryScope(ctx, db, warehouseScope);
  const input: HistoryInput = {category: source.category, subtype: "", from: "1900-01-01", to: "9999-12-31", farm: "", house: "", flock: "", batch: "", warehouse: ""};
  const query = sourceQuery(db, ctx, source, scope, input);
  if (!query) throw new HistoryError("UNAVAILABLE", 404);
  const {data, error} = await query.eq("id", id).maybeSingle();
  if (error) throw new HistoryError("LOAD_FAILED", 503);
  if (!data) throw new HistoryError("UNAVAILABLE", 404);
  const row = data as unknown as HistoryRow, item = itemFor(source, row, scope);
  const detail: HistoryDetail = {...item, fields: historyFields(source, row), supporting: [], correctionHref: null};
  const flock = scope.flocks.find(value => value.id === row.flock_id);
  const farmId = text(row.farm_id ?? flock?.farm_id);
  const correctable = ["daily_record", "loss_record", "feed_session", "health_event", "sale", "biosecurity_check"].includes(kind);
  if (ctx.role === "farm_manager" && correctable && (!flock || ["active", "quarantined"].includes(text(flock.status)))) {
    const proposed = Object.fromEntries(source.fields.filter(field => field.format !== "code").map(field => [field.key, row[field.key] ?? ""]));
    const path = {daily_farm_records: "/app/daily-records", feeding_session_records: "/app/feeding-log", health_events: "/app/health", biosecurity_checks: "/app/health", daily_sales_records: "/app/sales"}[source.table] ?? "/app/governance";
    const target = new URLSearchParams({record: id, source_id: id, filter_view: "1", filter_preset: "custom", filter_dateFrom: item.date, filter_dateTo: item.date});
    if (row.flock_id) target.set("filter_flockId", text(row.flock_id));
    if (row.batch_id) target.set("filter_batchId", text(row.batch_id));
    if (farmId) target.set("filter_farmId", farmId);
    const params = new URLSearchParams({request_type: "locked_correction", source_table: source.table, source_id: id, source_version: text(row.updated_at), farm_id: farmId, destination: `${item.date} · ${item.context}`, proposed_values: JSON.stringify(proposed), correction_route: `${path}?${target}`});
    detail.correctionHref = `/app/governance?${params}`;
  }
  if (kind === "daily_record" || kind === "loss_record") {
    const events = sourceQuery(db, ctx, historySources.find(value => value.kind === "mortality_event")!, scope, input);
    if (events) {
      const result = await events.eq("flock_id", row.flock_id).eq("record_date", row.record_date).order("id").limit(101);
      if (result.error) throw new HistoryError("LOAD_FAILED", 503);
      if ((result.data?.length ?? 0) > 100) throw new HistoryError("DETAIL_TOO_LARGE", 422);
      detail.supporting.push(...((result.data ?? []) as unknown as HistoryRow[]).map(event => ({kind: "mortality_event", fields: historyFields(historySources.find(value => value.kind === "mortality_event")!, event)})));
    }
    if (kind === "daily_record") {
      const movements = sourceQuery(db, ctx, historySources.find(value => value.kind === "stock_movement")!, scope, {...input, category: "stock"});
      if (movements) {
        const result = await movements.eq("daily_record_id", id).order("id").limit(101);
        if (result.error) throw new HistoryError("LOAD_FAILED", 503);
        if ((result.data?.length ?? 0) > 100) throw new HistoryError("DETAIL_TOO_LARGE", 422);
        const movementRows = (result.data ?? []) as unknown as HistoryRow[];
        const itemIds = [...new Set(movementRows.map(movement => text(movement.item_id)).filter(value => historyUuid.test(value)))];
        const products = itemIds.length ? await db.from("inventory_items").select("id,name,unit").eq("org_id", ctx.orgId).in("id", itemIds).limit(101) : {data: [], error: null};
        if (products.error) throw new HistoryError("LOAD_FAILED", 503);
        detail.supporting.push(...movementRows.map(movement => {
          const product = (products.data as HistoryRow[] | null)?.find(value => value.id === movement.item_id);
          return {kind: "stock_movement", fields: [{key: "item", value: text(product?.name) || null}, {key: "unit", value: text(product?.unit) || null}, ...historyFields(historySources.find(value => value.kind === "stock_movement")!, movement)]};
        }));
      }
    }
  }
  if (row.item_id || row.feed_item_id) {
    const result = await db.from("inventory_items").select("name,unit").eq("org_id", ctx.orgId).eq("id", row.item_id ?? row.feed_item_id).maybeSingle();
    if (result.error) throw new HistoryError("LOAD_FAILED", 503);
    detail.fields.unshift({key: "item", value: result.data?.name ?? null}, {key: "unit", value: result.data?.unit ?? null});
  }
  if (kind === "vaccination_completion") {
    const vaccineId = /^SCHEDULE_STATUS\|([^|]+)\|completed\|vaccination$/.exec(text(row.description))?.[1];
    if (!vaccineId || !historyUuid.test(vaccineId)) throw new HistoryError("UNAVAILABLE", 404);
    const result = await db.from("vaccination_events").select("vaccine_name,birds_vaccinated,dosage,route,batch_number").eq("org_id", ctx.orgId).eq("id", vaccineId).eq("flock_id", row.flock_id).is("voided_at", null).maybeSingle();
    if (result.error) throw new HistoryError("LOAD_FAILED", 503);
    if (!result.data) throw new HistoryError("UNAVAILABLE", 404);
    detail.fields = Object.entries(result.data).map(([key, value]) => ({key, value: value as string | number | null, ...(key === "route" ? {format: "code" as const} : {})}));
  }
  if (kind === "operating_day" && Array.isArray(row.exceptions)) {
    detail.supporting = row.exceptions.map(value => {
      const exception = value as HistoryRow;
      return {kind: "exception", fields: [{key: "flock", value: text(scope.flocks.find(f => f.id === exception.flock_id)?.flock_code) || null}, {key: "reason", value: text(exception.reason)}, {key: "requirement", value: text(exception.requirement), format: "code"}]};
    });
  }
  return detail;
}
