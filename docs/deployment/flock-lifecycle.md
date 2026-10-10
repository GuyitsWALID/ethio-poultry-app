# Flock lifecycle delivery evidence

Change: `openspec/changes/simplify-flock-lifecycle`, linked to `simplify-farm-operations`.

## Current release checkpoint — 2026-10-10

All six lifecycle migrations through `20261010001000` are applied to staging `uzmhpecehmlwojdmitgj`. The guarded staging runner verified nine clean preflight checks, locked migration history, effective evidence views, private internal-helper permissions and unchanged fingerprints of Daily Records, sales, stock ledger, feed closures, mortality, culls, flock populations and canonical batches. Only the new lifecycle metadata was excluded from those comparisons. Production was not accessed.

Broader archived correction now supports reviewed linked death/cull changes and whole-cycle final departure allocation amendments. Original evidence remains immutable; removed events retain before/after audit snapshots; archived populations remain zero; sale revenue, payments, feed and stock are unchanged. Local dry run, all 12 integration suites, broader correction assertions and placement/closure/replay concurrency passed. All 342 unit tests and lint passed before the final generated-schema refresh; final build and check results follow the release record.

Generated schema types now come from the migrated disposable local database, not the original unmigrated local API. Old flock URLs redirect before shell streaming. Authenticated local period and authorization checks passed; inline profile and 7/30/90 controls were observed. A reduced-motion test checked duration even though `transition-property: none` disables animation; the assertion is corrected but its rerun is not yet claimed.

Still open: final release builds/branch push, authenticated staging application checks, user-owned manual tablet/Amharic checks and full same-day Finish/offline acceptance. The upgrade is not declared pilot-ready. Earlier sections below retain chronological evidence; their old counts-only/staging-unchanged blockers are superseded by this checkpoint.

## Latest continuation — 2026-10-10

### Broader correction follow-up (supersedes the counts-only limitation below)

`20261010001000_archived_cycle_accounting_amendments.sql` now supports explicitly reviewed linked death/cull event changes and complete shared-cycle final-departure allocation amendments. Original evidence remains immutable, removed loss events retain audit snapshots, and archived populations remain zero. Effective views supply profile clearance counts and sale capacity to subsequent closures. The amendment cannot change financial sale quantities/revenue, payments, feed, stock, placement or completion times. Existing non-bird-unit physical capacity cannot be silently replaced.

Fresh disposable Docker replay passed 14 pending migrations, populated preservation, all 12 integration files and broader correction assertions. Assertions cover new/updated/removed loss events, exact totals, immutable originals, effective allocations, sale over-allocation rejection, replay, sequential amendments and unchanged sale values. Read-only staging preflight returned zero rows for all nine checks. Authenticated local browser/release checks and staging migration are still in progress; these results are not production authorization.

The fifth lifecycle candidate, `20261010000000_reviewed_archived_cycle_corrections.sql`, adds exact CEO-approved historical Daily Record bird-count amendments for verified non-legacy archived cycles. Managers propose under Flocks / Manage batch cycles / verified archived cycle; CEO review and manager application use the existing Governance workflow. It retains the original physical closure and sale allocations, prevents resurrection, revalidates source revisions and appends immutable evidence. It does not authorize edits to linked death/cull events, physical departure evidence, sales, feed or stock. Broader invalidating-source corrections remain a release blocker, not a completed feature.

Fresh Docker replay passed all 13 pending migrations, populated preservation checks, all 12 integration files and the new archived-correction regression. The original local database remained unchanged. Full unit tests and TypeScript passed; migration lock contains 81 files. Local environment validation now passes without changing or exposing secrets. Matching staging/automation configuration remains operator-owned. Tablet/Amharic checks are assigned to the user. No staging migration or push has occurred during this continuation.

Full ESLint subsequently passed with required filesystem access. Concurrent placement, shared-cycle closure and applied-request replay tests passed against the latest migrated template. Additional archived-correction assertions reject revoked assignments and balanced attempts to restate final departures; fixture changes rolled back. The first sandboxed production build failed on Wrangler registry filesystem permissions; the elevated retry compiled successfully and is still completing its remaining build stages. Do not treat compilation alone as a passing production build.

Final standalone TypeScript, the 81-file migration contract and whitespace checks passed after the nullable historical-read type was corrected. Exact approved snapshot recognition also passed its rollback-only database assertion. The production build passed compilation, its TypeScript stage and generation of all 100 static pages; final trace collection is still pending at this checkpoint.

The elevated production build subsequently completed successfully (exit 0), including final trace collection. This is a local Next.js production build, not a Cloudflare build or a deployment. Broader closure-evidence corrections and the other listed acceptance gates remain open; staging and production are unchanged.

## Current implementation

The inline profile and authorized period read interface are implemented locally. New presentation includes clear selection, lifecycle contrast, 7/30/90-day periods, evidence coverage, sample-age weight targets, combined performance/next steps, dated authoritative Today tasks and disabled History. Old profile URLs preserve their context into the same workspace. Current canonical ledger formulas remain unchanged.

Cycle context, inline creation/closure forms, exact Governance previews and transactional placement/closure are also implemented locally. Final-day health and supplies confirmations are included in closure readiness. Repeated submission of the same client identity and payload recovers the existing request after current-assignment verification; a different payload cannot reuse that identity. Exact batch/cycle links resolve their trusted farm on the server and reject conflicting targets.

Legacy archives without approved completion evidence remain unverified. Their period results are unavailable rather than guessed from the last record. The new completion-attestation path records verified empty-house evidence without resetting historical bird counts.

## New migrations

- `20261007000000_safe_flock_cycle_foundation.sql`: adds farm-scoped cycle grouping without replacing canonical batch IDs; backfills only unambiguous singleton cohorts; adds immutable closure, clearance, sale allocation, physical head-count and per-record change evidence; enforces tenant access and retires automatic branch replacement.
- `20261007001000_atomic_flock_cycle_governance.sql`: applies CEO-approved placement and closure in database transactions; checks revisions, occupancy, final records, feeding, health/supplies evidence and exact physical departures; preserves existing deaths/culls and valid zero confirmations; records audit evidence and one-time application results.
- `20261007002000_completed_flock_operating_guards.sql`: recognizes old/new same-day flock identities, rejects routine writes against completed flocks, protects final evidence and prevents resurrection; protects original batch membership/counts, actual arrival/age and historical bird-count/mortality evidence; recognizes only exact approved source snapshots in reconciliation.
- `20261008000000_approved_whole_flock_moves.sql`: retains original canonical placement while recording a CEO-approved whole-flock movement into an empty cleared house; enforces exact source/destination revisions, both farm assignments, immutable history, valid movement chains and completion after the last move. Unsafe legacy transfer approvals require refreshed review.

These migrations are forward-only release candidates, not deployed changes. Passing their local replay does not bypass the remaining release gates.

## Read-only preflight

`supabase/verification/flock_lifecycle_preflight.sql` reports overlaps, ambiguous batch membership, broken lineage, starting/current population discrepancies, future active placements, legacy completion evidence and pending lifecycle approvals. Run with an operator connection and `ON_ERROR_STOP=1`. It begins a read-only transaction and rolls back. Reports can contain trusted internal identifiers; do not publish raw operator output in manager-facing interfaces.

Review mapping and approved transfer chains explicitly. No names, dates or supplier matches establish shared membership. Legacy archives require verified completion attestation before reuse. No report row authorizes automatic source repair.

## Remaining release gates

The whole-flock transfer adapter and movement-chain-aware lineage are implemented and database-tested, with an inline bilingual proposal form. Authenticated browser acceptance is pending. The governed invalidating-source correction workflow remains unfinished: current guards reject changes to protected final accounting rather than silently changing closure evidence or resurrecting birds. This remains a deployment blocker.

Still required: concurrent closure tests, generated schema catalogue refresh, old/new Today finish/offline acceptance, English/Amharic tablet and reduced-motion checks, production/Cloudflare builds and authenticated staging checks. The true concurrent placement test passed. Read-only staging preflight passed before migration. Do not deploy or describe this work as the completed safe-cycle upgrade.

Production unchanged. No staging migration, deployment, commit or push performed.

## Local checks — 2026-10-09

- Full unit suite passed after checksum/terminology-manifest updates, including new whole-flock, movement-aware workspace and completed-Today regressions.
- TypeScript and full ESLint passed after the latest inline move form and workspace changes.
- Migration checksum contract regenerated for 80 files. Strict OpenSpec validation passed.
- Final `git diff --check`: passed.
- Production build: stopped by the existing environment guard because `MONITORING_INGEST_TOKEN` is too short. No secret/environment edits or guard bypass.
- Docker Engine 28.4.0: running. Disposable `ethio_flock_lifecycle_dryrun_20261007` was recreated from the original local schema, with no original database writes.
- All 12 pending migrations replayed successfully, including the four lifecycle candidates. Populated before/after backfill assertions passed. Repeat with `node scripts/test-flock-lifecycle-dryrun.mjs` (recreates only the explicitly named disposable Docker clone).
- All 12 database integration files passed, including shared closure, legacy attestation, kilogram head-count evidence, rollback, repeated application, revoked access, immutable evidence, same-day applicability and whole-flock movement/closure ordering.
- `node scripts/test-flock-cycle-concurrency.mjs` passed: two independent sessions competing for the same house produced one approved placement and one safe stale rejection without partial mutation.
- Read-only preflight executed against intentionally conflicted local fixtures; returned rows remain operator-review blockers, not automatic repair instructions. This is not evidence that staging/production preflight is clean.
- Read-only pre-migration staging preflight executed against verified project `uzmhpecehmlwojdmitgj`: all nine checks returned zero conflicts; transaction rolled back. No staging mutation or production access performed. Migrated authenticated application acceptance is still pending.

## Additional local acceptance — 2026-10-10

- The concurrency runner now also tests two independent approved requests closing the same shared cycle. Exactly one closure commits, both member clearances are recorded once, and the shared sale is allocated for exactly 194 birds. Existing deaths/culls remain unchanged. This passed on 2026-10-09.
- Simultaneous retries of the already-applied closure also passed without duplicate dispositions or population deductions.
- `scripts/test-flock-lifecycle-browser.mjs` creates a unique disposable database from the migrated Docker template, with separate local Auth/REST services and random local-only credentials. It does not redirect the normal Supabase API, change `.env.local`, or use staging credentials. Auth migration-history metadata is copied read-only; real users are not copied. Today is enabled through the signed-in CEO function, not a flag bypass.
- `tests/browser/flock-lifecycle.spec.ts` covers authorized period reads, missing evidence, exact Today actions, inline/old-profile compatibility, tablet portrait/landscape, reduced motion, keyboard controls, Amharic persistence and CEO/manager result parity. Execution is in progress; existence of these tests is not passing evidence.
- Anonymous lifecycle API denial and private/no-store assertions passed against the migrated local API. Signed-in execution stopped on a local browser fetch failure. Current sign-in selectors were corrected and explicit CORS authorization headers added to the local-only proxy, but that proxy correction is not yet verified. The next run was blocked when Docker Engine stopped; PowerShell also failed to initialize with `0xC0000142`. No signed-in/tablet/Amharic acceptance is claimed.
- Focused ESLint and TypeScript passed on 2026-10-10 before the final test-selector/proxy-header edits. Script syntax, whitespace and the 80-file migration lock passed. The normal local database remains at migration `20260927000000`. Release environment validation still rejects the short `MONITORING_INGEST_TOKEN`; test-generated credentials do not resolve that release configuration.
- Archived invalidating-source correction workflow, full same-day Finish/offline acceptance, schema catalogue refresh, release builds and authenticated staging acceptance remain open. No staging migration or git push has occurred.

## Operational notes

2026-10-10 restart continuation: Docker is healthy. Windows reserved test ports 54331–54333; the disposable runner moved to 45431–45433. Live checks verified the duplicate-CORS-origin fix. Signed-in manager profile reads returned 200 for all three periods, 400 for an invalid period and 404 for inaccessible targets; however the complete test timed out while a cold route compiled for 41 seconds. Tablet/Amharic cases were not reached. Browser trace proved `accept-profile` and `x-retry-count` were missing from the local proxy preflight allowlist; the allowlist is corrected but that final change remains unverified. Focused lint passed before the final proxy edits, and script syntax passed before the final allowlist edit. No staging migration or git push; release blockers remain in force.

The regular local Supabase API still connects to the original `postgres` database, not the migrated disposable clone. Passing the Docker SQL suites does not establish authenticated browser/API acceptance against the new schema. Do not accidentally run the local browser against staging and report it as a migrated local test. A separately verified migrated local API is required for that gate.
