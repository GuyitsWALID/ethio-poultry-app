import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../supabase/migrations/20260813000000_reconciliation_ai_advisor.sql", import.meta.url), "utf8");

test("AI analysis migration creates append-only scoped history", () => {
  assert.match(sql, /create table if not exists public\.reconciliation_ai_analyses/i);
  assert.match(sql, /alter table public\.reconciliation_ai_analyses enable row level security/i);
  assert.match(sql, /public\.has_active_break_glass\(f\.org_id\)/i);
  assert.match(sql, /before update or delete on public\.reconciliation_ai_analyses/i);
  assert.match(sql, /revoke insert, update, delete on public\.reconciliation_ai_analyses from anon, authenticated/i);
});

test("AI history stores versions, usage, evidence hash, and support attribution", () => {
  for (const column of ["evidence_hash", "prompt_version", "schema_version", "input_tokens", "output_tokens", "support_session_id", "evidence_snapshot"]) {
    assert.match(sql, new RegExp(`\\b${column}\\b`, "i"));
  }
});
