import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMigrationLock,
  validateEnvironment,
  validateMigrationSequence,
  verifyMigrationLock,
} from "../scripts/deployment-contract.mjs";

const valid = {
  APP_ENVIRONMENT:"production",
  APP_RELEASE:"abcdef123456",
  APP_BASE_URL:"https://app.ethiopoultry.com",
  NEXT_PUBLIC_SUPABASE_URL:"https://project-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"publishable-key-value",
  SUPABASE_SERVICE_ROLE_KEY:"service-role-key-value",
  SUPABASE_PROJECT_REF:"project-ref",
  ADMIN_ACCESS_CODE:"strong-random-code",
  MONITORING_INGEST_TOKEN:"monitoring-ingest-token-value",
};

test("production environment accepts a complete immutable deployment identity",()=>{
  assert.deepEqual(validateEnvironment(valid).errors,[]);
});

test("production environment rejects local endpoints, missing identity, and shared keys",()=>{
  const result=validateEnvironment({...valid,APP_RELEASE:"",APP_BASE_URL:"http://localhost:3000",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_SERVICE_ROLE_KEY:valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY});
  assert.equal(result.ok,false);
  assert(result.errors.some(error=>error.includes("APP_RELEASE")));
  assert(result.errors.some(error=>error.includes("APP_BASE_URL")));
  assert(result.errors.some(error=>error.includes("NEXT_PUBLIC_SUPABASE_URL")));
  assert(result.errors.some(error=>error.includes("must be different")));
});

test("retired anonymous-key variable produces a migration warning",()=>{
  const result=validateEnvironment({...valid,APP_ENVIRONMENT:"ci",NEXT_PUBLIC_SUPABASE_ANON_KEY:"legacy"});
  assert(result.warnings.some(warning=>warning.includes("unused")));
});

test("production identity rejects a Supabase project-reference mismatch",()=>{
  const result=validateEnvironment({...valid,SUPABASE_PROJECT_REF:"different-project"});
  assert(result.errors.some(error=>error.includes("does not match")));
});

test("enabled reconciliation AI requires a server-only Groq secret in production",()=>{
  const missing=validateEnvironment({...valid,RECONCILIATION_AI_ENABLED:"true"});
  assert.match(missing.errors.join("\n"),/GROQ_API_KEY is required/);
  const configured=validateEnvironment({...valid,RECONCILIATION_AI_ENABLED:"true",GROQ_API_KEY:"gsk_test_server_only_key"});
  assert.equal(configured.errors.some(error=>error.includes("GROQ")),false);
  const exposed=validateEnvironment({...valid,NEXT_PUBLIC_GROQ_API_KEY:"never-public"});
  assert.match(exposed.errors.join("\n"),/NEXT_PUBLIC_GROQ_API_KEY is forbidden/);
});

test("Cloudflare builds cannot silently fall back to the local environment",()=>{
  const result=validateEnvironment({...valid,APP_ENVIRONMENT:"",WORKERS_CI_COMMIT_SHA:"abcdef123456"});
  assert.equal(result.ok,false);
  assert(result.errors.some(error=>error.includes("explicitly set for a Cloudflare build")));
});

test("notification email remains server-only and requires a valid sender when enabled",()=>{
  const disabled=validateEnvironment({...valid,NOTIFICATION_EMAIL_ENABLED:"false"});
  assert.equal(disabled.errors.some(error=>error.includes("NOTIFICATION_EMAIL")),false);
  const missing=validateEnvironment({...valid,NOTIFICATION_EMAIL_ENABLED:"true"});
  assert.match(missing.errors.join("\n"),/NOTIFICATION_EMAIL_FROM is required/);
  const invalid=validateEnvironment({...valid,NOTIFICATION_EMAIL_ENABLED:"true",NOTIFICATION_EMAIL_FROM:"not-an-email"});
  assert.match(invalid.errors.join("\n"),/valid sender address/);
  const configured=validateEnvironment({...valid,NOTIFICATION_EMAIL_ENABLED:"true",NOTIFICATION_EMAIL_FROM:"operations@example.com"});
  assert.equal(configured.errors.some(error=>error.includes("NOTIFICATION_EMAIL")),false);
  const exposed=validateEnvironment({...valid,NEXT_PUBLIC_NOTIFICATION_EMAIL_FROM:"never-public"});
  assert.match(exposed.errors.join("\n"),/must remain server-only/);
});

test("monitoring intake tokens are strong and remain server-only when configured",()=>{
  const short=validateEnvironment({...valid,MONITORING_INGEST_TOKEN:"too-short"});
  assert.match(short.errors.join("\n"),/at least 24 characters/);
  const exposed=validateEnvironment({...valid,NEXT_PUBLIC_MONITORING_INGEST_TOKEN:"never-public"});
  assert.match(exposed.errors.join("\n"),/NEXT_PUBLIC_MONITORING_INGEST_TOKEN is forbidden/);
  const buildWithoutRuntimeBindings=validateEnvironment({...valid,MONITORING_INGEST_TOKEN:""});
  assert.equal(buildWithoutRuntimeBindings.errors.some(error=>error.includes("MONITORING")),false);
});

test("reviewed migration chain matches its committed cryptographic lock",async()=>{
  const result=await verifyMigrationLock();
  assert.deepEqual(result.errors,[]);
});

test("verified production baseline is part of the migration release identity",async()=>{
  const lock=await buildMigrationLock();
  assert.equal(lock.baseline.schemaSha256,"a05316d0b7878aeeac36032e9966b62d98b94dd07d53d28ee0d96c8f2718f424");
  assert.equal(lock.baseline.containsBusinessData,false);
  assert(lock.baselineCoveredVersions.includes("20260505064542"));
  assert(lock.baselineCoveredVersions.includes("20260809000000"));
});

test("migration history requires unique 14-digit versions",()=>{
  const valid=validateMigrationSequence([
    "20260516000000_first.sql",
    "20260516001000_second.sql",
    "20260809000000_baseline_head.sql",
    "20260811100000_future.sql",
  ],"20260809000000_baseline_head.sql");
  assert.deepEqual(valid.errors,[]);

  const invalid=validateMigrationSequence([
    "20260809000000_baseline_head.sql",
    "20260812_date_only.sql",
    "20260812120000_first.sql",
    "20260812120000_second.sql",
  ],"20260809000000_baseline_head.sql");
  assert(invalid.errors.some(error=>error.includes("14-digit")));
  assert(invalid.errors.some(error=>error.includes("Duplicate migration version")));
});
