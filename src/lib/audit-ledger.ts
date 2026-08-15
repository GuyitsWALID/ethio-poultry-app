import "server-only";

import {governanceAdmin} from "@/lib/access-context";
import {auditReason,sanitizeAuditSnapshot} from "@/lib/audit-ledger-contract";

type JsonRecord=Record<string,unknown>;

export type AuditOperation="insert"|"update"|"delete"|"execute"|"decision"|"access"|"authentication";
export type AuditActorContext={orgId:string;userId:string;role:string;supportSessionId:string|null};

export type AuditEventInput={
  eventType:string;
  operation:AuditOperation;
  entityTable:string;
  entityId:string;
  reason:string;
  before?:unknown;
  after?:unknown;
  farmId?:string|null;
  houseId?:string|null;
  flockId?:string|null;
  batchId?:string|null;
  warehouseId?:string|null;
  metadata?:JsonRecord;
};

/**
 * Records readable workflow meaning alongside the atomic database-trigger
 * evidence. Callers provide one compact event; actor, tenant, role, support
 * custody, secret redaction, and failure handling stay inside this module.
 */
export async function recordAuditEvent(ctx:AuditActorContext,input:AuditEventInput){
  const row={
    org_id:ctx.orgId,
    actor_id:ctx.userId,
    actor_role:ctx.role,
    support_session_id:ctx.supportSessionId,
    event_type:input.eventType.trim(),
    operation:input.operation,
    source:"semantic",
    entity_table:input.entityTable.trim(),
    entity_id:input.entityId,
    reason:auditReason(input.reason),
    farm_id:input.farmId??null,
    house_id:input.houseId??null,
    flock_id:input.flockId??null,
    batch_id:input.batchId??null,
    warehouse_id:input.warehouseId??null,
    before_values:input.before===undefined?null:sanitizeAuditSnapshot(input.before),
    after_values:input.after===undefined?null:sanitizeAuditSnapshot(input.after),
    metadata:sanitizeAuditSnapshot(input.metadata??{}) as JsonRecord,
  };
  const {data,error}=await governanceAdmin.from("governance_audit_events").insert(row).select("id,event_hash,sequence_number").single();
  if(error)throw new Error(`Audit history could not be recorded: ${error.message}`);
  return data;
}
