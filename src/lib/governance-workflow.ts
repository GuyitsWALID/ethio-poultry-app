/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import type { AccessContext } from "@/lib/access-context";
import { canAccessFarm, canAccessWarehouse, governanceAdmin } from "@/lib/access-context";
import { recordAuditEvent } from "@/lib/audit-ledger";

const requestTypes = ["batch_create","batch_archive","flock_place","flock_transfer","flock_close","flock_archive","feed_template","breed_target","health_schedule","warning_threshold","locked_correction","void_record"] as const;
const sourceTables = new Set(["flocks","batches","feed_control_settings","daily_farm_records","daily_sales_records","health_events","vaccination_events","feeding_session_records","biosecurity_checks","batch_weight_check_tasks"]);
const db = governanceAdmin as any;

export type GovernanceInput = {
  request_type?: string; intent?: string; reason?: string; farm_id?: string|null; warehouse_id?: string|null;
  source_table?: string|null; source_id?: string|null; source_version?: string|null; changed_fields?: string[];
  proposed_values?: Record<string,unknown>; correction_route?: string|null; finding_id?: string|null;
  references?: Array<{label?:string;url?:string}>; idempotency_key?: string|null;
};

type Row = Record<string,any>;

function text(value:unknown){return typeof value==="string"?value.trim():""}
function human(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase())}
function safeRoute(value:unknown){const route=text(value);return route.startsWith("/app/")?route:null}
function defaultRoute(type:string,table:string|null,id:string|null){
  if(type.startsWith("batch_"))return "/app/batches";
  if(type.startsWith("flock_"))return id?`/app/flocks/${id}`:"/app/flocks";
  if(table==="daily_farm_records")return "/app/daily-records";
  if(table==="daily_sales_records")return "/app/sales";
  if(table==="health_events"||table==="vaccination_events"||type==="health_schedule")return "/app/health";
  if(type==="feed_template"||type==="warning_threshold")return "/app/feeding-log";
  return "/app/governance";
}

async function profileSnapshot(ctx:AccessContext){
  const {data:profile,error}=await governanceAdmin.from("profiles").select("full_name,role").eq("id",ctx.userId).eq("org_id",ctx.orgId).single();
  if(error)throw new Error(error.message);
  const now=new Date().toISOString();
  const [farmAssignments,warehouseAssignments]=await Promise.all([
    governanceAdmin.from("user_farm_access").select("farm_id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`),
    governanceAdmin.from("user_warehouse_access").select("warehouse_id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);
  const farmIds=(farmAssignments.data??[]).map(row=>String(row.farm_id));
  const warehouseIds=(warehouseAssignments.data??[]).map(row=>String(row.warehouse_id));
  const [farms,warehouses]=await Promise.all([
    farmIds.length?governanceAdmin.from("farms").select("id,name").in("id",farmIds):Promise.resolve({data:[]}),
    warehouseIds.length?governanceAdmin.from("warehouses").select("id,name").in("id",warehouseIds):Promise.resolve({data:[]}),
  ]);
  return{name:profile.full_name?.trim()||"Farm Manager",role:String(profile.role),scope:{farms:(farms.data??[]).map(row=>({id:row.id,name:row.name})),warehouses:(warehouses.data??[]).map(row=>({id:row.id,name:row.name}))}};
}

async function labelMaps(ctx:AccessContext){
  const [farms,houses,flocks,batches,warehouses,branches]=await Promise.all([
    governanceAdmin.from("farms").select("id,name,branch_id").eq("org_id",ctx.orgId),
    governanceAdmin.from("houses").select("id,name,farm_id").eq("org_id",ctx.orgId),
    governanceAdmin.from("flocks").select("id,flock_code,farm_id,house_id,batch_id").eq("org_id",ctx.orgId),
    governanceAdmin.from("batches").select("id,batch_code,farm_id,house_id").eq("org_id",ctx.orgId),
    governanceAdmin.from("warehouses").select("id,name,farm_id,branch_id").eq("org_id",ctx.orgId),
    governanceAdmin.from("branches").select("id,name").eq("org_id",ctx.orgId),
  ]);
  const maps=new Map<string,string>();
  for(const [rows,key] of [[farms.data,"name"],[houses.data,"name"],[flocks.data,"flock_code"],[batches.data,"batch_code"],[warehouses.data,"name"],[branches.data,"name"]] as Array<[Row[]|null,string]>)for(const row of rows??[])maps.set(String(row.id),String(row[key]));
  return{maps,farms:farms.data??[],houses:houses.data??[],flocks:flocks.data??[],batches:batches.data??[],warehouses:warehouses.data??[],branches:branches.data??[]};
}

function readableValues(values:Record<string,unknown>,maps:Map<string,string>){
  return Object.entries(values).map(([field,value])=>({field,label:human(field),value:typeof value==="string"&&maps.has(value)?maps.get(value):value}));
}

async function sourceEvidence(ctx:AccessContext,table:string|null,id:string|null,changed:string[],maps:Map<string,string>){
  if(!table||!id||!sourceTables.has(table))return{version:null,values:[] as Array<{field:string;label:string;value:unknown}>,record:null as Row|null};
  const {data,error}=await db.from(table).select("*").eq("id",id).eq("org_id",ctx.orgId).maybeSingle();
  if(error)throw new Error(error.message);if(!data)throw new Error("The affected record was not found.");
  const fields=changed.length?changed:Object.keys(data).filter(key=>!["id","org_id","created_at","updated_at"].includes(key)).slice(0,12);
  return{version:data.updated_at??null,values:fields.map(field=>({field,label:human(field),value:typeof data[field]==="string"&&maps.has(data[field])?maps.get(data[field]):data[field]})),record:data};
}

function readableSourceLabel(table:string|null,record:Row|null,maps:Map<string,string>){
  if(!table||!record)return null;
  if(table==="flocks")return maps.get(String(record.id))??"Flock";
  if(table==="batches")return maps.get(String(record.id))??"Batch cycle";
  if(table==="daily_farm_records")return `${maps.get(String(record.flock_id))??"Flock"} Daily Record · ${record.record_date}`;
  if(table==="daily_sales_records")return `${record.product_label??"Sale"} · ${record.sale_date}`;
  if(table==="health_events")return `${human(String(record.event_type??"Health event"))} · ${record.event_date}`;
  if(table==="vaccination_events")return `Vaccination · ${record.scheduled_date??record.administered_on??"scheduled date"}`;
  if(table==="feeding_session_records")return `${maps.get(String(record.flock_id))??"Flock"} ${record.session_name??"feeding session"} · ${record.record_date}`;
  if(table==="biosecurity_checks")return `Biosecurity check · ${record.checklist_date}`;
  if(table==="batch_weight_check_tasks")return `Weight check · ${record.due_date}`;
  if(table==="feed_control_settings")return "Feed Control warning thresholds";
  return `${human(table)} record`;
}

export async function submitGovernanceRequest(ctx:AccessContext,input:GovernanceInput){
  const requestType=text(input.request_type);const reason=text(input.reason);const farmId=text(input.farm_id)||null;const warehouseId=text(input.warehouse_id)||null;
  const sourceTable=text(input.source_table)||null;const sourceId=text(input.source_id)||null;const changed=[...new Set((input.changed_fields??[]).map(text).filter(Boolean))];
  const proposed=input.proposed_values&&typeof input.proposed_values==="object"?input.proposed_values:{};
  if(!requestTypes.includes(requestType as typeof requestTypes[number])||reason.length<8)throw new Error("Choose a supported change and explain why it is needed.");
  if(farmId&&!await canAccessFarm(ctx,farmId))throw new Error("The affected farm is outside your active assignment.");
  if(warehouseId&&!await canAccessWarehouse(ctx,warehouseId))throw new Error("The affected warehouse is outside your active assignment.");
  if(sourceTable&&!sourceTables.has(sourceTable))throw new Error("This source record cannot be changed through Governance.");
  if(Object.keys(proposed).length===0||changed.length===0)throw new Error("At least one requested change is required.");
  const [requester,labels]=await Promise.all([profileSnapshot(ctx),labelMaps(ctx)]);
  const source=await sourceEvidence(ctx,sourceTable,sourceId,changed,labels.maps);
  const sourceRecord=source.record??{};const flockId=text(sourceRecord.flock_id)||text(proposed.flock_id);const flock=labels.flocks.find((row:Row)=>String(row.id)===flockId);
  const houseId=text(sourceRecord.house_id)||text(proposed.house_id)||text(flock?.house_id);const batchId=text(sourceRecord.batch_id)||text(proposed.batch_id)||text(flock?.batch_id);
  const resolvedFarmId=farmId||text(sourceRecord.farm_id)||text(proposed.farm_id)||text(flock?.farm_id);
  const farmName=resolvedFarmId?labels.maps.get(resolvedFarmId)??null:null;const warehouseName=warehouseId?labels.maps.get(warehouseId)??null:null;
  const intent=text(input.intent)||requestType;
  const context={title:human(requestType),farmName,houseName:houseId?labels.maps.get(houseId)??null:null,flockName:flockId?labels.maps.get(flockId)??null:null,batchName:batchId?labels.maps.get(batchId)??null:null,warehouseName,sourceLabel:sourceId?(readableSourceLabel(sourceTable,source.record,labels.maps)??`${human(sourceTable??"record")} record`):"New governed record",currentValues:source.values,proposedValues:readableValues(proposed,labels.maps),impact:requestType==="void_record"?"The original record remains auditable and normal calculations exclude it.":"Only the listed values may change after approval."};
  const row={org_id:ctx.orgId,request_type:requestType,intent,farm_id:farmId,warehouse_id:warehouseId,source_table:sourceTable,source_id:sourceId,source_version:input.source_version||source.version,changed_fields:changed,proposed_values:proposed,reason,requested_by:ctx.userId,requester_name_snapshot:requester.name,requester_role_snapshot:requester.role,requester_scope_snapshot:requester.scope,context_snapshot:context,correction_route:safeRoute(input.correction_route)||defaultRoute(requestType,sourceTable,sourceId),finding_id:text(input.finding_id)||null,latest_submitted_at:new Date().toISOString(),idempotency_key:text(input.idempotency_key)||crypto.randomUUID()};
  const {data,error}=await db.from("governance_requests").insert(row).select("*").single();
  if(error){if(error.code==="23505")throw new Error("An active request already covers this record and change.");throw new Error(error.message)}
  await db.from("governance_request_activity").insert({org_id:ctx.orgId,request_id:data.id,action:"submitted",actor_id:ctx.userId,actor_name_snapshot:requester.name,actor_role_snapshot:requester.role,note:reason});
  for(const reference of input.references??[]){const url=text(reference.url);if(!url)continue;await db.from("governance_request_evidence").insert({org_id:ctx.orgId,request_id:data.id,reference_label:text(reference.label)||"Supporting reference",reference_url:url,uploaded_by:ctx.userId})}
  await recordAuditEvent(ctx,{eventType:"governance_request.submitted",operation:"decision",entityTable:"governance_requests",entityId:String(data.id),reason,after:data,farmId,warehouseId});
  return data;
}

export async function loadGovernanceDesk(ctx:AccessContext){
  await db.rpc("expire_governance_authorizations");
  const query=db.from("governance_requests").select("*").eq("org_id",ctx.orgId).order("requested_at",{ascending:false}).limit(250);
  const {data:all,error}=await query;if(error)throw new Error(error.message);
  let rows=all??[];
  if(ctx.role==="farm_manager"&&!ctx.supportSessionId){
    const now=new Date().toISOString();const [farms,warehouses]=await Promise.all([
      governanceAdmin.from("user_farm_access").select("farm_id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`),
      governanceAdmin.from("user_warehouse_access").select("warehouse_id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`),
    ]);const farmIds=new Set((farms.data??[]).map(row=>String(row.farm_id)));const warehouseIds=new Set((warehouses.data??[]).map(row=>String(row.warehouse_id)));
    rows=rows.filter((row:Row)=>row.requested_by===ctx.userId||(row.status==="approved"&&(farmIds.has(String(row.farm_id))||warehouseIds.has(String(row.warehouse_id)))));
  }
  const ids=rows.map((row:Row)=>row.id);const [activity,evidence,labels]=await Promise.all([
    ids.length?db.from("governance_request_activity").select("*").in("request_id",ids).order("created_at",{ascending:true}):Promise.resolve({data:[]}),
    ids.length?db.from("governance_request_evidence").select("id,request_id,reference_label,reference_url,file_name,content_type,byte_size,uploaded_at").in("request_id",ids).order("uploaded_at",{ascending:true}):Promise.resolve({data:[]}),
    labelMaps(ctx),
  ]);
  return{meta:{role:ctx.role,canApprove:ctx.role==="ceo",canRequest:ctx.role==="farm_manager"},requests:rows.map((row:Row)=>({...row,activity:(activity.data??[]).filter((item:Row)=>item.request_id===row.id),evidence:(evidence.data??[]).filter((item:Row)=>item.request_id===row.id)})),options:{farms:labels.farms,warehouses:labels.warehouses,flocks:labels.flocks,batches:labels.batches,houses:labels.houses,branches:labels.branches}};
}

export async function refreshGovernanceRequestContext(ctx:AccessContext,requestId:string,values:Record<string,unknown>){
  const [{data:request,error},labels]=await Promise.all([
    db.from("governance_requests").select("id,context_snapshot").eq("id",requestId).eq("org_id",ctx.orgId).single(),
    labelMaps(ctx),
  ]);
  if(error)throw new Error(error.message);
  const context={...(request.context_snapshot??{}),proposedValues:readableValues(values,labels.maps)};
  const updated=await db.from("governance_requests").update({context_snapshot:context}).eq("id",requestId).eq("org_id",ctx.orgId);
  if(updated.error)throw new Error(updated.error.message);
}

export function governanceAlertTitle(row:Row,role:string){
  const manager=row.requester_name_snapshot||"A Farm Manager";const label=row.context_snapshot?.sourceLabel||human(row.request_type);
  if(role==="ceo"&&row.status==="pending")return `${manager} submitted a change for ${label}`;
  if(role==="farm_manager"&&row.status==="approved")return `Approved: fix ${label} before ${new Date(row.approval_expires_at).toLocaleDateString("en",{timeZone:"Africa/Addis_Ababa"})}`;
  if(role==="farm_manager"&&row.status==="returned")return `CEO returned your ${label} request`;
  if(row.status==="conflict")return `Governance request needs fresh source values: ${label}`;
  return `Governance request ${row.status}: ${label}`;
}

export async function getGovernanceAlerts(ctx:AccessContext){
  const desk=await loadGovernanceDesk(ctx);const actionable=new Set(ctx.role==="ceo"?["pending","conflict"]:["approved","returned","conflict","expired"]);
  return desk.requests.filter((row:Row)=>actionable.has(String(row.status))).slice(0,20).map((row:Row)=>({
    id:`governance-${row.id}`,
    title:governanceAlertTitle(row,ctx.role),
    severity:(row.status==="conflict"||row.status==="expired"?"high":"medium") as "high"|"medium",
    source:"Governance" as const,
    context:row.status==="pending"?`Submitted by ${row.requester_name_snapshot||"Farm Manager"}`:String(row.decision_note??row.reason),
    route:`/app/governance?request=${encodeURIComponent(row.id)}`,
    createdAt:String(row.latest_submitted_at??row.decided_at??row.updated_at??row.requested_at),
    farmId:row.farm_id?String(row.farm_id):null,
    warehouseId:row.warehouse_id?String(row.warehouse_id):null,
  }));
}
