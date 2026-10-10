# Tasks

## Current release checkpoint — 2026-10-10

The broader archived correction is implemented and database-tested: exact loss-event changes and complete-cycle final departure amendments preserve original evidence, zero archived population, sale capacity and financial/stock values. Six lifecycle migrations are now applied to staging `uzmhpecehmlwojdmitgj`; migration head, private helper permissions and unchanged fingerprints of eight operational source tables passed. Production was not accessed.

Latest local verification: 14-migration fresh replay, populated preservation, all 12 database integration suites, broader correction assertions, two-session placement/closure/replay, 342 unit tests and full lint passed. Schema catalogue refreshed from the migrated local clone; two optional RPC arguments now omit empty values and use their existing SQL NULL defaults. Legacy flock links redirect before the authenticated shell streams. Authenticated period/authorization tests pass; inline rendering and all periods were observed, but the reduced-motion assertion incorrectly checked duration rather than the disabled transition property. The assertion is corrected; remaining browser acceptance is not claimed yet.

Final build, branch push and authenticated staging application checks are tracked separately. Manual tablet/Amharic checks remain with the user; full same-day Finish/offline acceptance remains open. Earlier chronological notes below are historical checkpoints, not current blockers or release claims.

## Latest verification — 2026-10-10 archived correction continuation

### Broader correction follow-up

The earlier counts-only limitation is superseded locally by `20261010001000_archived_cycle_accounting_amendments.sql`: exact linked loss-event additions/updates/removals, complete shared-cycle departure amendments, effective capacity/clearance reads, immutable originals, zero-population preservation, bilingual forms and complete CEO previews are implemented. Fresh Docker replay passed 14 migrations and all 12 integration suites, plus broader correction assertions for event totals, sale over-allocation, sequential amendments, replay, original evidence and unchanged sale values. Remote staging preflight is clean; migration/application release checks are still in progress. No production approval is implied.

- Added the manager-proposed, CEO-approved `archived_cycle_correction` path for exact existing Daily Record bird-count fields on verified, non-legacy archived cycles. Application preserves original closure/departure evidence and zero live population, checks source revisions and adjacent-day balances, and appends immutable correction/audit evidence. Valid unchanged zero-supplies confirmations are carried forward; newly added losses invalidate no-health confirmations.
- This is not a general closure restatement: changes to linked mortality/cull events, sale allocations or physical final departures remain blocked. Legacy completion attestations cannot authorize reconstructed historical counts. Task 6 remains open for those broader invalidating-source cases.
- Fresh Docker replay passed all 13 pending migrations, populated preservation checks, all 12 integration files and the new archived-correction regression. Original local `postgres` history remained unchanged; no remote database was used.
- Full unit suite, TypeScript and whitespace checks passed. Migration lock regenerated for 81 files. Local environment validation now passes; this does not verify matching staging/automation secrets.
- User will perform tablet/Amharic checks. Release builds and remaining authenticated acceptance are still being checked. No staging migration or push is implied by these local results.
- Subsequent verification: full lint, final TypeScript, migration contract and Next.js production build passed. Latest-template concurrent placement/closure/replay passed; revoked-assignment, immutable physical-departure and exact corrected-snapshot assertions passed. Cloudflare build and remaining release acceptance are not claimed.

- [x] 1. Save approved scope, design, requirements and staged acceptance; preserve clean `notmain` baseline.
- [x] 2. Implement authorized profile read module, period calculations and focused regressions.
- [ ] 3. Implement obvious selection, readable badges, inline profile, exact actions, localization and old-profile compatibility.
- [x] 4. Add read-only lifecycle preflight and operator mapping requirements.
- [x] 5. Add shared-cycle schema, safe legacy singleton mapping, immutable closure/allocation/head-count evidence and RLS.
- [x] 6. Implement atomic approved cycle closure/attestation and source protection with target-specific audit recognition.
- [x] 7. Implement atomic actual-date placement, occupied-house/concurrency safeguards and retirement of branch replacement.
- [ ] 8. Add authorized cycle context and inline finish/create forms with Governance previews.
- [ ] 9. Preserve approved whole-flock transfers, lineage targets and reconciliation compatibility.
- [ ] 10. Recalculate Today same-day applicability and reject completed/stale offline writes while preserving drafts.
- [ ] 11. Pass focused/full tests, TypeScript, lint, production/Cloudflare builds, migration/RLS dry runs and bilingual tablet/browser checks.
- [ ] 12. Resolve staging preflight explicitly, migrate/validate staging and commit/push reviewed work to `notmain`. Production unchanged.

No task is complete merely because its UI exists. Database transitions require transaction/RLS tests; release requires authenticated staging evidence.

## Local progress — 2026-10-09

- Task 3: visible selection, contrast, inline 7/30/90-day presentation, disabled History and old-profile routing implemented. Tablet, reduced-motion and authenticated browser acceptance remain open.
- Tasks 4–5: preflight runs read-only against the disposable Docker database. Populated before/after migration fixtures verify canonical IDs, unambiguous singleton mapping, unchanged legacy counts and unresolved ambiguous records. No operator mapping is guessed.
- Task 6: approved multi-house closure, legacy completion attestation, sale/head-count allocations, exact audit recognition, source guards and explicit-zero evidence carry-forward pass transactional database tests. Guards now also protect original batch membership/counts, actual arrival/age, historical bird-count records and mortality history after verified clearance. Ordinary historical Governance authorization cannot bypass these physical-evidence guards. The governed workflow for later corrections that invalidate closure evidence remains unfinished.
- Task 7: actual-date placement, independent house counts, approval revisions and occupied-house protection implemented and database-tested. True two-session approved placement race passed: exactly one placement committed, the competing request failed safely without partial records. Concurrent closure acceptance remains open.
- Task 8: authorized context, create/close forms and per-record Governance previews implemented. Health/supplies prerequisites now appear in the form. Submission retry identities preserve the exact request, and batch/cycle links resolve trusted targets. Authenticated browser acceptance remains open.
- Task 9: approved whole-flock transfer adapter, immutable movement history, source/destination revisions, cross-farm assignment checks and movement-chain-aware reconciliation implemented. Inline English/Amharic move proposal and lazy authorized context added. Workspace preserves only each authorized flock's linked original placement metadata after cross-farm movement. Removed the misleading automatic move-back correction shortcut. Database tests cover partial moves, quarantine, stale approvals, revoked access, replay and closure ordering after movement. Authenticated browser compatibility remains open.
- Task 10: completed-source write guards and same-day old/new applicability implemented and database-tested. Per-identity Today read-only presentation and regression implemented: completed old flock remains reviewable while its replacement is independently editable. Full Finish day turnover and offline replay acceptance remain open.

Docker Engine 28.4.0 is running. All 12 migrations newer than the original local baseline replayed from scratch in `ethio_flock_lifecycle_dryrun_20261007`; populated before/after fixtures and all 12 database integration suites passed. `scripts/test-flock-lifecycle-dryrun.mjs` makes this isolated replay repeatable. Only the disposable clone was recreated. Original local database, staging and production remain unchanged.

Latest full unit suite passed after updating the migration checksum and adding the new Today notice to the terminology manifest as pending partner review. English/Amharic catalogue keys match. TypeScript, full lint, strict OpenSpec validation and diff whitespace checks passed. Migration lock regenerated for 80 files. Production build was retried and remains blocked by existing invalid `MONITORING_INGEST_TOKEN` configuration (minimum 24 characters); secrets and guards were not changed.

Read-only staging preflight ran against the explicitly verified staging project `uzmhpecehmlwojdmitgj` on 2026-10-09. All nine checks returned zero conflicts, and the transaction rolled back. This is a pre-migration data check, not migrated application/browser acceptance. No staging migration, deployment, commit or push performed. The governed workflow for invalidating archived closure evidence remains a release blocker. See `docs/deployment/flock-lifecycle.md`.

## Test continuation — 2026-10-10

Task 7 concurrent closure acceptance is now verified: two approved requests racing on the same shared cycle yield exactly one closure, no duplicated sale allocations and no repeated deaths/culls. Concurrent replay of the applied request also passed. The dedicated migrated local Auth/API browser runner and browser scenarios are added; browser acceptance remains open until their execution passes. This does not complete the remaining governed correction workflow or authorize deployment.

Anonymous lifecycle API denial/private caching checks passed against the migrated local API. Signed-in tests remain unverified: test selectors were updated and a local proxy CORS fix added, then Docker Engine stopped and PowerShell initialization failed (`0xC0000142`) before the rerun. No signed-in, tablet or Amharic passing result is claimed. TypeScript/focused lint passed before the final fixture-only edits; the deployment environment still rejects the short monitoring token. No staging writes or git push.

Docker was restarted successfully on 2026-10-10. Windows reserved the original test port range, so the isolated runner now uses ports 45431–45433 and cleans up containers even when startup fails. Duplicate upstream CORS origins were diagnosed and fixed; a live single-origin regression passed. The signed-in manager successfully received 7/30/90-day results, invalid-period rejection and inaccessible-target rejection, but the overall test timed out during a 41-second cold route compilation. Remaining browser cases did not run. Trace evidence also identified missing `accept-profile`/`x-retry-count` CORS headers; these were added to the local proxy but have not been rerun. Full browser acceptance is not claimed. Archived-source amendment, normal release configuration and other listed release gates still block staging migration and `notmain` deployment.
