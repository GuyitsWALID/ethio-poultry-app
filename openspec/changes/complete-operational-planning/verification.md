# Implementation checkpoint — 2026-10-30

## Task 6 — release acceptance boundary, 2026-11-05

- Tasks 1–5 have separate `notmain` checkpoints. All 34 forward migrations,
  including `20261104000000_farm_expense_confirmations.sql`, are applied to the
  pinned staging project `uzmhpecehmlwojdmitgj`. Production is not approved.
- Automated English/Amharic Chromium tablet viewports and disposable fixture
  transactions do not substitute for physical-device or cross-browser acceptance.
- Remaining rollout gates: real target tablets in both orientations, supported
  browser/installed-app offline restart and interrupted upgrade checks, partner
  review of new terminology, backup/restore drill, silent manager usability test
  and seven unassisted operating days under simplify-farm-operations Task 8.
- Preserve staging business records and assignments during acceptance. Missing
  report evidence must not be replaced with zero or manufactured records.
- The broader CEO workspace remains gated; no production approval is implied.
- Staging run `41800702799` passed read-only populated CEO/manager report-source
  comparisons, exact History reads and English/Amharic 768/1024px operational
  screens, including Scheduler and Expenses & purchases. No records or grants
  were manufactured to satisfy these checks. The earlier sales 503 did not
  recur; that cancelled run `41795744254` is not passing evidence.
- Quality run `41800689013` passed 591 tests, TypeScript, lint, migration/environment
  contracts, browser discovery and production build for `7d7b469`.
- Acceptance fixed explicit EN selection being ignored while a delayed profile
  response preferred Amharic. The regression exercises the actual switch handler.
- Eight joined local lifecycle/bilingual/revocation checks passed. Final full
  offline-day Chromium acceptance passed on 2026-11-05 with no synthetic focus
  wake: disconnected reload, browser restart, seven dependent queued commands,
  automatic reconnect, stock reduced exactly once to 90, idempotent replay and
  one-time Finish day. Cache readiness is scoped to the selected farm.
- Final full unit suite: 596 passed, zero failures. Full lint passed after excluding
  generated Playwright traces/reports; application and test source remain covered.
- Offline recovery now falls back to prepared details only on transport failure,
  never an HTTP denial or malformed response. Editing still validates the saved
  identity/farm/flock/day grant, including expiry when the online hint is stale.
- Reconnect investigation: the browser reported online/visible and the session
  returned 200, but commands stayed queued until an explicit focus wake. A failed
  pre-sync authorization read had no retry. Pending work now retries after 30s,
  always rechecking session and assignment before any send; empty/terminal queues
  do not poll. The regression failed before the fix and passes after it. Storage
  failures remain blocking, and hidden/stopped clients never send.
- Durable test lessons: cache readiness must be scoped to the selected farm;
  generated trace JavaScript is not source lint input. Test-only reruns may reuse
  the verified local bundle; source changes require a fresh build.
- Final source changes passed a fresh TypeScript/production/OpenNext Cloudflare
  build and the original full-day reproduction. The static offline shell cache
  advances to v3 so installed clients can receive the recovery fixes. IndexedDB
  drafts/outbox are not deleted. Physical upgrade-failure checks remain a pilot gate.
- No new migration was introduced by Task 6. Disposable browser stacks were
  removed by the runner; the original local database was not migrated or reset.

## Completed implementation
- Saved and strictly validated the approved OpenSpec change.
- Verified actual-placement opening birds, dated preceding closes and stale
  source validation inside the existing Today atomic command transaction.
- Governed recording-start proposals, CEO decision and atomic assigned-manager
  application. Original placement/starting populations remain unchanged.
- Bilingual inline Today proposal form and readable approval field labels.
- Explicit unsold-egg zero, effective-date custody boundaries and preserved
  earlier source records. A historical loss correction before the physical
  baseline does not deduct that loss again from the new starting population.

## Evidence
- npm test: 561 passed, zero failed/skipped.
- TypeScript: passed after the recording-start contract/form fixes.
- Changed-source ESLint: passed, zero warnings.
- Migration contract: 99 files; two new forward migrations.
- Docker dry-run rebuilt only ethio_flock_lifecycle_dryrun_20261007,
  preserving the original local postgres database.
- All 31 forward migrations applied; populated preservation checks and every
  existing integration file passed, including the two new starting-source and
  baseline tests. Archived-correction assertions passed too.

## Open work / release boundary
This is not completion of the full proposed plan. Task 2 is complete locally as
documented below. Sales, Scheduler, Expenses and whole-release acceptance remain
in tasks, including staging and physical-device/cross-browser gates.
Both starting-count migrations are now applied to staging project
uzmhpecehmlwojdmitgj. The rollback-only preflight and post-deployment check passed:
permissions and operational source preservation verified; no pending migrations.
Release commits were pushed to notmain at 9225105; its GitHub Quality gate passed
(run 41117486059, confirmed 2026-10-31). Application deployment and authenticated
feature acceptance are not asserted here. No production change or pilot sign-off
has been performed. New manager labels have bilingual catalogs and
automated validation, not a new claim of independent partner review.

## Record Checks integration — 2026-10-31
- Task 2.3 implementation complete: the exact authorized finding can offer the
  shared physical-start form for today, without replacing old correction paths.
- Existing evidence, revoked/archived targets, CEO/support contexts and resolved
  findings do not receive a new-start form. Submission rechecks finding scope.
- Finding context survives approval/application links. A new physical start does
  not claim to repair historical discrepancies or automatically clear a check.
- Temporary network loss disables submission without discarding entered fields.
- Twelve focused tests, TypeScript and changed-source lint passed. Includes
  executable resolver/proposal tests using mocked transport, not a staging write.
- No new migration. These changes remain local pending release.

## Task 2 completion — 2026-10-31
- Tasks 2.1–2.5 are implemented and verified; Task 3 has not started.
- Full suite: 572 passed, no failures/skips. Full lint and TypeScript passed;
  final changed-source lint and strict OpenSpec validation also passed.
- A fresh production build passed against the disposable migrated local stack.
- All 31 forward migrations and populated preservation/integration checks passed
  in the fixed disposable dry-run database; the original local database and
  remote databases were not changed by these checks.
- Extended SQL acceptance closes a cycle with 98 physically counted birds while
  retaining the original 100-bird placement and zero new mortality; cross-tenant
  context reads and revoked access are rejected.
- `node scripts/test-recording-start-concurrency.mjs` passed real overlapping
  transactions: one baseline/egg opening row, replay-safe application, one daily
  start and a safe conflict for the competing command. Its clone was removed.
- `node scripts/test-flock-lifecycle-browser.mjs --recording-start-only` uses
  disposable accounts and an isolated Auth/PostgREST/database stack. Final
  signed-in Chromium run passed (1 test): proposal, CEO decision, application
  replay, physical baseline versus original placement, missing report evidence,
  English/Amharic inline context, 768/1024px layouts, offline reload, preserved
  command identity, and conflict after reconnect and Refresh today. The final
  test-only retry reused the fresh local bundle; that bundle is not deployable.
- Acceptance found and fixed an exact-flock link that failed to resolve its
  house on multi-house farms. Network-only recovery failures no longer imply
  sign-out; explicit identity/session denials and pre-sync authorization remain.
- Recovery still requires the normal authenticated Refresh today flow for this
  acceptance case; no claim of unrestricted or unauthenticated automatic sync.
- No new migration is required. Staging migration inspection on 2026-10-31
  confirmed the verified project uzmhpecehmlwojdmitgj has no pending migrations;
  both starting-count migrations are installed. Task 2 application changes use
  the notmain release path; post-deployment staging acceptance stays in section 6.
- Section 6 continues to track whole-release/Cloudflare, staging, physical-device
  and cross-browser acceptance. No production or pilot sign-off is implied.

## Task 3 — traceable egg sales, 2026-11-03

- Tasks 3.1–3.4 are implemented. Task 4 has not started. Reader/write-path details
  are recorded in `egg-sale-sources.md`.
- Full unit suite: 580 passed, no failures/skips. Full lint, TypeScript, fresh
  production build, strict OpenSpec, environment and migration contracts passed.
- Docker migration/integration checks cover exact quantities, single financial
  identity, legacy preservation, access/RLS, audit rollback, stale approvals,
  custody and immutable source revisions. Final correction and sale helper
  changes were rechecked in the disposable migrated template.
- Real concurrent transactions passed: only one competing sale can consume the
  available eggs; stable retry preserves one sale and one allocation revision.
- Signed-in Chromium passed combined-flock Today entry, History supporting
  sources, reviewed correction, apply replay, scoped cent totals, saved v3
  snapshot retry/frozen rendering and English/Amharic 768/1024px layouts. The
  initial test raced the asynchronous source dropdowns; it now waits for their
  selected values and asserts native form validity before submission.
- Staging rollback-only migration check passed against the pinned project
  `uzmhpecehmlwojdmitgj`, verifying permissions and unchanged original business
  fields. No production database was accessed.
- New terminology remains pending partner review; this does not extend the
  previous terminology sign-off. Physical-device and cross-browser acceptance
  remain section 6 release gates.
- The fresh production-bundle Chromium acceptance also passed (one test). The
  proper Cloudflare standalone build completed and generated the worker. An
  earlier packaging-only attempt could not reuse an ordinary non-standalone
  Next.js build; no generated local/test artifacts are committed or deployed.
- Staging migration `20261102000000_traceable_egg_sales.sql` committed successfully
  on 2026-11-03. The release transaction verified permission contracts and original
  operational-field fingerprints. Application release uses `notmain`; remote CI,
  deployment and post-deployment acceptance are separate from these local checks.

## Task 4 — named-flock Scheduler, 2026-11-03

- Tasks 4.1–4.6 are implemented. Task 5 has not started. Interface, permissions,
  generation and legacy boundaries are documented in `scheduler.md`.
- Full unit suite: 586 passed, no failures/skips. Final Scheduler regressions,
  changed-source ESLint, TypeScript and strict OpenSpec validation passed.
- Fresh production and OpenNext Cloudflare builds passed. Their disposable local
  configuration is never deployed or committed as generated artifacts.
- Docker dry run applied all 33 forward migrations; populated preservation,
  all 29 SQL integration files and archived-correction assertions passed. The
  original local postgres database was preserved.
- SQL acceptance covers 90-day generation, creator-role permissions, revisions,
  named targets, actual four-kind completion, inventory deductions once, replay,
  deferral, overdue escalation, RLS/revocation, forced audit rollback, source
  verification and atomic Finish-day blocking.
- The final real two-session completion race passed: one weight, one outcome
  audit, safe competing conflict and stable retry replay. Its clone was removed.
- Signed-in production-bundle Chromium passed manager plan creation, CEO-created
  plan protection, real weight recording, offline skip/reconnect and English/
  Amharic Scheduler at 768/1024px. The resulting Amharic screenshot was inspected;
  existing typography, palette and date controls were retained.
- Acceptance found and fixed invalid enum filtering, inaccessible select labels,
  whole-number weight-sample validity, and interrupted background preparation
  incorrectly pausing already cached forms. HTTP authorization and storage errors
  remain blocking; reconnect independently reauthorizes commands.
- The pinned staging rollback-only migration check passed with unchanged original
  operational-field fingerprints. Read-only legacy preflight found zero pending
  weight tasks, zero encoded targets and four encoded outcomes; none are converted.
- New terminology remains pending partner review. Physical-device, cross-browser,
  whole-release staging application acceptance and pilot gates remain in section 6.
  No production access or pilot sign-off is implied.
- Staging migration `20261103000000_named_flock_scheduler.sql` committed on
  2026-11-03 to `uzmhpecehmlwojdmitgj`. The release transaction verified permissions,
  the exact-source checker and unchanged original operational-field fingerprints.
  Application release uses `notmain`; remote deployment acceptance is not implied
  by the local/browser checks above.

## Task 5 — expenses and purchases, 2026-11-04

- Tasks 5.1–5.3 are implemented. Details are recorded in
  `expenses-purchases.md`; whole-release acceptance remains in section 6.
- Full unit suite: 590 passed, no failures. Strict OpenSpec validation passed.
- Docker dry run applied all 34 forward migrations and passed all 30 integration
  files, populated preservation checks and archived-correction assertions. The
  original local postgres database and its migration history were unchanged.
- Focused SQL covers farm templates without warehouse grants, request/monthly
  replay, different-evidence conflicts, CEO mutation denial, another farm/shared
  store denial, future dates, forced audit rollback, inherited receipt access,
  no duplicate purchase expense, RLS and revoked template reads.
- Real concurrent monthly confirmations passed: one template, one cost entry and
  one explicit audit event. The disposable clone was removed.
- Staging rollback-only preflight passed against the pinned project
  `uzmhpecehmlwojdmitgj`, preserving original costs, templates and stock fields.
- A stalled standalone TypeScript check was stopped during local Docker startup
  memory pressure. The final production build must run TypeScript before release.
- Full lint, final changed-source lint, TypeScript, fresh production/OpenNext
  Cloudflare builds and signed-in Chromium acceptance passed. Disposable local
  build artifacts are not deployable and are not committed.
- Browser acceptance covers farm-level monthly confirmation and retry, exact
  History navigation, template reuse in Today, a real stock receipt and English/
  Amharic 768/1024px layouts. Screenshot review also corrected the stretching farm
  selector and a success message that did not translate after a locale switch;
  the final browser run explicitly checks the Amharic success message.
- Monthly retry History links use the original persisted entry date, not a newly
  requested date. Final focused regressions passed after that correction.
- New terminology remains pending partner review; deployed staging application,
  physical-device, cross-browser and pilot acceptance remain section 6 gates.
  Production is not approved.
- Staging migration `20261104000000_farm_expense_confirmations.sql` committed on
  2026-11-04 to `uzmhpecehmlwojdmitgj`. The release transaction verified permission
  contracts, Today delegation, receipt replay guards and unchanged original costs,
  templates and stock fields. Application release uses `notmain`; no production
  database or deployment was accessed.
