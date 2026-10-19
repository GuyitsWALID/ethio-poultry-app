# Implementation checkpoint — reporting foundation

Date: 2026-10-18. This is an implementation checkpoint, not release acceptance.

## Changed
- Effective warehouse permission checks for operations stock, sales stock/expenses and finance evidence; farm permission checks on sales production denominators.
- Shared target validation rejects unavailable/contradictory scope rather than substituting data.
- Inclusive Addis timestamp bounds; stable paginated legacy sales/inventory reads with explicit failure above the 100,000-row safety bound, not partial totals.
- Historical flock inclusion and verified clearance-date coverage bounds; unverified legacy completion is marked unavailable. Approved movement-chain attribution remains open.
- Historical weight targets use measurement age; daily targets use recorded bird counts, not today's archived population.
- Feed consumption costs exclude warehouse transfers, subtract returns and remain unavailable if any consumption cost is missing. This corrects the former transfer/partial-cost overstatement without changing source records.
- Current creator role is rechecked before scheduled generation. CSV text is formula-protected; failed schedule forms remain open. These changes do not yet make snapshot persistence/audit atomic.

## Checks
- OpenSpec strict validation passed.
- 54 focused tests passed (report safety, pagination, evidence, management reports, operational analytics, report workspace, inventory workflow, farm/warehouse access).
- TypeScript passed, including the final incremental check after the lifecycle-boundary follow-up.
- Focused ESLint passed, including the final lifecycle/inventory check.
- Some inherited tests assert source contracts; these do not substitute for migrated-database authorization/concurrency tests.

## Not released / still open
No new migration or staging/production mutation, commit or push in this checkpoint. No new visual workspace yet. Atomic saved-report finalization/claims, recipient resource checks, legacy snapshot/RLS restrictions, movement-chain history, complete mixed-cohort formulas and the new read model remain open. Staging's Unavailable eggs fixture has not yet been inspected. Full builds/browser/staging acceptance are deferred until integration, not reported as passed.

## Follow-up: local checkpoint and atomic report runs
- Foundation committed locally as `04d53cd`; not pushed.
- Added forward migration `20261018001000_atomic_management_report_runs.sql`: service-only operation claims, leases, payload identity checks, atomic completed/failed report evidence and semantic audit, and atomic scheduled-run advancement. Existing snapshots remain unchanged.
- Manual browser retries retain command identity after failure. Scheduled retries retain their original due period; concurrent workers receive a busy result. Stale schedule settings cannot overwrite the next run.
- Migration DDL applied to disposable Docker database `ethio_flock_lifecycle_dryrun_20261007`; corrected function definitions and rollback-only `management-report-transactions.integration.sql` passed. Cases include audit failure rollback, completed replay/lost response, changed payload, competing/stale claims, cross-tenant access, demoted creator, stale schedule configuration and revoked farm assignment.
- Six behavioral orchestration tests passed. The database claim test covers busy/replay behavior but is not yet a true simultaneous multi-connection test.
- Combined focused set: 60 tests passed; incremental TypeScript and focused ESLint passed. Migration lock verification passed for 90 files, including the new transaction migration.
- Warehouse provenance/recipient scope, legacy snapshot/RLS restrictions and atomic schedule-definition changes remain open. Consistent all-topic evidence capture is still part of the forthcoming read model, not claimed by this persistence transaction.
- No staging or production migration and no push. New application RPC calls require this migration before deployment.

## Follow-up: warehouse snapshot permissions and legacy restrictions (2026-10-19)
- Added `20261019000000_management_report_resource_permissions.sql`. No historical rows or hashes are rewritten. Legacy v1 snapshots are CEO-only; new interim v1-scoped snapshots carry source manifests from the server analytics reader, not browser-supplied permissions.
- Publication holds permission evidence and checks the creator and each recipient. Inherited stores, explicit shared-store grants, active status and current farm assignments remain authoritative. Incomplete warehouse identity cannot be guessed to permit manager sharing.
- Both saved-list metadata and downloads use database-authorized readers; direct authenticated SELECT uses the same current-access check through RLS. Denied legacy rows are filtered before the existing 30-row limit. Full pagination and the forthcoming all-topic v2 format are not implemented in this step.
- Direct service-role table access is revoked too, so old service-key readers cannot bypass the new rule on rollback. Application reads/writes use authorized security-definer RPCs; the migration blocks if inherited direct table privileges remain. Rollback must retain these readers; older incompatible binaries fail closed rather than re-expose snapshots.
- Scoped failed attempts contain no snapshot and persist a generic message, protecting private warehouse error details while retaining safe manager failure history. Legacy renderers retain the saved version label; unknown versions fail closed. Download error responses are private/no-store too.
- Docker applied the forward migration to `ethio_flock_lifecycle_dryrun_20261007`. Rollback-only resource tests passed, including missing/expired/revoked shared grants, inherited/new farm stores, inactive warehouses, foreign-tenant evidence, legacy immutability, revoked farm access, inactive CEO, direct authenticated RLS, actor spoofing, service-only read privileges and 35 inaccessible newer legacy rows. The prior atomic-report transaction test also passed with the new guard installed.
- Final focused set: 65 tests passed; focused ESLint, incremental TypeScript, diff whitespace checks and the 91-migration lock contract passed. Docker confirmed direct service table access is false and checked-reader execution remains true.
- No staging/production migration, push or additional commit in this step. Authenticated application/browser acceptance and true multi-connection races remain for integrated verification.

## Follow-up: atomic schedule definitions and actual concurrent workers (2026-10-19)
- Saved the preceding snapshot/permission changes locally as `bb17c06`; not pushed.
- Added `20261019001000_atomic_management_report_schedules.sql`: service-only CEO create/pause/resume RPCs commit schedule changes and semantic audit together. Current authority is rechecked, changes require a fresh schedule revision, and resume revalidates creator/recipients. Direct service-role schedule writes are revoked; server callers now use these RPCs.
- Docker applied the migration to the disposable dry-run database. Rollback-only schedule tests passed: injected audit failures on create/pause/resume, stale edits, cross-tenant/manager/inactive-CEO rejection, weekly-day validation, revision advancement, no-op retry and service/browser privilege checks.
- `management-report-concurrency.mjs` created a uniquely named disposable database clone, ran two simultaneous connections for manual and scheduled generation, and verified one completed report, one semantic audit and the same replay identity. The clone was removed afterward; application data was not changed.
- 17 focused report tests, incremental TypeScript, focused ESLint and the 92-migration lock contract passed. Full application builds and authenticated staging/browser acceptance remain deferred to integration. No staging/production migration or push.
