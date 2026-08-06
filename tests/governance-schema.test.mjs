import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const migration=await readFile(new URL("../supabase/migrations/20260804_governance_permissions_foundation.sql",import.meta.url),"utf8");
const closureMigration=await readFile(new URL("../supabase/migrations/20260806_item2_governance_closure.sql",import.meta.url),"utf8");

test("governance migration enforces sole CEO and explicit assignment windows",()=>{assert.match(migration,/profiles_one_active_ceo_per_org/);assert.match(migration,/starts_at<=now\(\).*revoked_at is null.*expires_at/s);assert.match(migration,/delete from public\.user_branch_access/)});
test("break glass is CEO decided, four-hour limited, and access audited",()=>{assert.match(migration,/break_glass_session_max_four_hours/);assert.match(migration,/current_active_role\(\)<>'ceo'/);assert.match(migration,/record_support_access/);assert.match(migration,/support_session_id/)});
test("operational records are voided and audit events are append-only",()=>{assert.match(migration,/reject_business_hard_delete/);assert.match(migration,/Governance audit events are append-only/);assert.match(migration,/voided_at timestamptz/)});
test("operating-day closure validates records and feed before Addis locking",()=>{assert.match(migration,/All active flocks require a Daily Record and closed feeding day/);assert.match(migration,/Africa\/Addis_Ababa/);assert.match(migration,/operational_day_lock_time/)});
test("closure migration records assignment and support revocation reasons",()=>{assert.match(closureMigration,/user_farm_access[\s\S]*revocation_reason/);assert.match(closureMigration,/user_warehouse_access[\s\S]*revocation_reason/);assert.match(closureMigration,/revoke_break_glass_session/);assert.match(closureMigration,/Only the tenant CEO or the assigned administrator/)});
test("operating-day scheduler is installed and observable",()=>{assert.match(closureMigration,/governance_scheduler_health/);assert.match(closureMigration,/last_completed_at/);assert.match(closureMigration,/create extension if not exists pg_cron/);assert.match(closureMigration,/cron\.schedule\('lock-overdue-farm-operating-days','\*\/15 \* \* \* \*'/)});
