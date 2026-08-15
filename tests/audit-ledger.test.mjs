import assert from "node:assert/strict";
import test from "node:test";

import {auditChanges,auditReason,describeAuditEvent,sanitizeAuditSnapshot} from "../src/lib/audit-ledger-contract.ts";

test("audit snapshots recursively redact credentials",()=>{
  assert.deepEqual(sanitizeAuditSnapshot({name:"Farm",apiKey:"hidden",nested:{password:"hidden",amount:25}}),{name:"Farm",apiKey:"[redacted]",nested:{password:"[redacted]",amount:25}});
});

test("audit reasons are mandatory and bounded",()=>{
  assert.throws(()=>auditReason("no"),/at least four/);
  assert.equal(auditReason("  Routine stock receipt  "),"Routine stock receipt");
  assert.equal(auditReason("x".repeat(2100)).length,2000);
});

test("technical row events receive readable descriptions",()=>{
  assert.deepEqual(describeAuditEvent({event_type:"record.update",operation:"update",entity_table:"daily_farm_records",reason:"Corrected count",actor_role:"farm_manager"}),{title:"Updated",subject:"daily farm records",reason:"Corrected count",actorRole:"farm manager"});
});

test("audit changes show business values without database identifiers",()=>{
  const changes=auditChanges(
    {id:"05d1dd37-dcad-4629-ab3d-b94570b6953f",status:"open",quantity:10,warehouse_id:"25d1dd37-dcad-4629-ab3d-b94570b6953f"},
    {id:"05d1dd37-dcad-4629-ab3d-b94570b6953f",status:"closed",quantity:12,warehouse_id:"35d1dd37-dcad-4629-ab3d-b94570b6953f"},
  );
  assert.deepEqual(changes,[
    {field:"status",before:"open",after:"closed"},
    {field:"quantity",before:"10",after:"12"},
  ]);
});
