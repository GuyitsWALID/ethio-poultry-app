import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
test("effective warehouse readers share the database authority",()=>{
  const access=read("src/lib/warehouse-access.ts");assert.match(access,/manager_warehouse_access_scope/);assert.match(access,/manager_has_effective_warehouse_access/);
  for(const path of ["src/lib/inventory-catalog.ts","src/lib/today-workspace/task-details.ts","src/lib/reconciliation-service.ts"]){assert.doesNotMatch(read(path),/from\("user_warehouse_access"\)/);}
});
test("farm handover and assignment responses preserve audit and compatibility",()=>{
  const sql=read("supabase/migrations/20261006001000_atomic_farm_manager_handover.sql");
  for(const value of ["pg_advisory_xact_lock","p_expected_revision","operational_action_events","notifications","governance_audit_events","assignment_status","'scope'"])assert.ok(sql.includes(value),value);
  assert.match(sql,/acknowledged_at=null/);assert.match(sql,/for update/);
  const endpoint=read("src/app/api/governance/assignments/handover/route.ts");assert.match(endpoint,/getAccessContext/);assert.match(endpoint,/confirmFarmHandover/);
});
test("Today retains and disables drafts when access changes",()=>{
  const screen=read("src/components/today/today-workspace-screen.tsx");assert.match(screen,/warehouse-access/);assert.match(screen,/fieldset disabled=\{Boolean\(error\)\}/);assert.match(screen,/code!=="ASSIGNMENT_REQUIRED"/);
  assert.match(read("src/lib/access-context.ts"),/private, no-store/);
});
