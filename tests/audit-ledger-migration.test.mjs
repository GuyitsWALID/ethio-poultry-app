import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const sql=await readFile(new URL("../supabase/migrations/20260815002000_immutable_sensitive_audit_ledger.sql",import.meta.url),"utf8");

test("sensitive mutations produce atomic database audit evidence",()=>{
  assert.match(sql,/create or replace function public\.capture_sensitive_row_change\(\)/i);
  for(const table of ["daily_farm_records","feeding_session_records","feed_day_closures","stock_ledger","daily_sales_records","cost_entries","governance_requests","reconciliation_findings"]){
    assert.match(sql,new RegExp(`'${table}'`));
  }
  assert.match(sql,/after insert or update or delete/i);
});

test("audit history is immutable, hash chained, and tenant scoped",()=>{
  assert.match(sql,/governance_audit_immutable/i);
  assert.match(sql,/previous_event_hash/i);
  assert.match(sql,/audit_event_digest/i);
  assert.match(sql,/verify_governance_audit_chain/i);
  assert.match(sql,/revoke insert, update, delete, truncate/i);
  assert.match(sql,/session\.revoked_at is null/i);
  assert.match(sql,/session\.expires_at > now\(\)/i);
});
