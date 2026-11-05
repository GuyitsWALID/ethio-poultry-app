import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("CEO branch setup collects and validates age at placement", async () => {
  const [modal, route] = await Promise.all([
    read("../src/components/ceo/setup-modal.tsx"),
    read("../src/app/api/ceo/setup/route.ts"),
  ]);

  assert.match(modal, /age_at_placement_days:\s*number\s*\|\s*""/);
  assert.match(modal, /Age at Placement \(Days\)/);
  assert.match(modal, /min="0"/);
  assert.match(route, /Number\.isInteger\(ageAtPlacementDays\)/);
  assert.match(route, /Age at placement must be a whole number of days/);
});

test("CEO branch setup uses the operation calendar for placement, not the branch name", async () => {
  const modal = await read("../src/components/ceo/setup-modal.tsx");

  assert.match(modal, /Branch Name<\/label>\s*<input/);
  assert.match(modal, /Placement Date<\/label>\s*<OperationDateInput/);
});

test("CEO setup transaction persists the supplied age on batches and flocks", async () => {
  const migration = await read(
    "../supabase/migrations/20261023000000_fix_ceo_setup_age_at_placement.sql"
  );

  assert.match(
    migration,
    /v_age_at_placement_days\s*:=\s*nullif\(p_intake_batch->>'age_at_placement_days',\s*''\)::integer/
  );
  assert.match(migration, /intakeBatch\.age_at_placement_days is required and must be non-negative/);
  assert.match(
    migration,
    /placement_date,\s*age_at_placement_days,\s*total_count/
  );
  assert.match(
    migration,
    /current_count,\s*age_at_placement_days,\s*purchase_cost_per_bird/
  );
  assert.ok(
    (migration.match(/v_age_at_placement_days/g) ?? []).length >= 5,
    "validated age must be reused for both batch and flock writes"
  );
});
