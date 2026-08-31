import {accessJson,getAccessContext,governanceAdmin,isAccessResponse} from "@/lib/access-context";
import {auditChanges,describeAuditEvent} from "@/lib/audit-ledger-contract";

const safeFilter=(value:string|null)=>value&&/^[a-z0-9_.-]+$/i.test(value)?value:null;

export async function GET(request:Request){
  const ctx=await getAccessContext({tenant:true});
  if(isAccessResponse(ctx))return ctx;

  const url=new URL(request.url);
  const limit=Math.min(250,Math.max(1,Number(url.searchParams.get("limit")??100)));
  const operation=safeFilter(url.searchParams.get("operation"));
  const entityTable=safeFilter(url.searchParams.get("entityTable"));
  const eventType=safeFilter(url.searchParams.get("eventType"));
  const from=url.searchParams.get("from");
  const to=url.searchParams.get("to");

  let query=governanceAdmin.from("governance_audit_events").select("*").eq("org_id",ctx.orgId).order("occurred_at",{ascending:false}).limit(limit);
  if(operation)query=query.eq("operation",operation);
  if(entityTable)query=query.eq("entity_table",entityTable);
  if(eventType)query=query.eq("event_type",eventType);
  if(from&&/^\d{4}-\d{2}-\d{2}$/.test(from))query=query.gte("occurred_at",`${from}T00:00:00.000Z`);
  if(to&&/^\d{4}-\d{2}-\d{2}$/.test(to))query=query.lte("occurred_at",`${to}T23:59:59.999Z`);

  if(ctx.role==="farm_manager"){
    const now=new Date().toISOString();
    const [farmAccess,warehouseAccess]=await Promise.all([
      governanceAdmin.from("user_farm_access").select("farm_id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`),
      governanceAdmin.from("user_warehouse_access").select("warehouse_id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`),
    ]);
    const scope=[`actor_id.eq.${ctx.userId}`];
    const farms=(farmAccess.data??[]).map(row=>String(row.farm_id));
    const warehouses=(warehouseAccess.data??[]).map(row=>String(row.warehouse_id));
    if(farms.length)scope.push(`farm_id.in.(${farms.join(",")})`);
    if(warehouses.length)scope.push(`warehouse_id.in.(${warehouses.join(",")})`);
    query=query.or(scope.join(","));
  }
  if(ctx.role==="system_admin")query=query.eq("support_session_id",ctx.supportSessionId!);

  const {data,error}=await query;
  if(error)return accessJson({error:error.message},500);
  const events=data??[];
  const actorIds=[...new Set(events.map(row=>row.actor_id).filter(Boolean).map(String))];
  const {data:profiles,error:profileError}=actorIds.length
    ?await governanceAdmin.from("profiles").select("id,full_name").in("id",actorIds)
    :{data:[],error:null};
  if(profileError)return accessJson({error:profileError.message},500);
  const names=new Map((profiles??[]).map(row=>[String(row.id),String(row.full_name)]));
  const enriched=events.map(row=>{
    const display=describeAuditEvent(row);
    return {
      key:String(row.sequence_number),
      title:display.title,
      subject:display.subject,
      reason:display.reason,
      actorName:row.actor_id?names.get(String(row.actor_id))??"Known user":"System process",
      actorRole:display.actorRole,
      occurredAt:String(row.occurred_at),
      evidenceType:row.source==="database_trigger"?"automatic":"workflow",
      changes:auditChanges(row.before_values,row.after_values),
    };
  });

  let integrity:null|Record<string,unknown>=null;
  if(ctx.role==="ceo"){
    const {data:result,error:integrityError}=await governanceAdmin.rpc("verify_governance_audit_chain",{p_org_id:ctx.orgId});
    if(integrityError)return accessJson({error:`Audit integrity verification failed: ${integrityError.message}`},500);
    integrity=result as Record<string,unknown>;
  }

  const safeIntegrity=integrity?{
    valid:Boolean(integrity.valid),
    eventCount:Number(integrity.eventCount??0),
    firstInvalidSequence:integrity.firstInvalidSequence===null?null:Number(integrity.firstInvalidSequence),
    verifiedAt:String(integrity.verifiedAt),
  }:null;

  return accessJson({events:enriched,integrity:safeIntegrity,meta:{role:ctx.role,limit}});
}
