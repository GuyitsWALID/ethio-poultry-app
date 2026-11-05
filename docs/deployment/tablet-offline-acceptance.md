# Tablet, Amharic and offline-day acceptance

## Owner acceptance — 2026-10-14

The owner completed manual localhost offline testing and reported everything
working, accepted Task 5 and authorized staging migration followed by the
`notmain` push. This supersedes the earlier hold on staging below. No additional
broad browser rerun was requested. Automated full-day cross-browser acceptance,
physical-tablet/upgrade-failure checks and the unassisted production pilot are
not claimed by this manual confirmation. Production remains excluded.

Staging release completed: `20261013000000_today_receipt_chains.sql` applied to
project `uzmhpecehmlwojdmitgj`. Locked migration preflight, migration head and
internal-helper permissions passed. Operational and organization fingerprints
were unchanged. No production database was accessed. The accompanying `notmain`
push supplies the staging application build; deployment completion is a separate
Cloudflare/CI result, not implied by database success.

## Offline completion implementation — 2026-10-14

The earlier implementation blockers below are now historical. Today has a
data-free offline shell, preloaded authorized task details, identity-scoped
IndexedDB recovery after reload/restart, and explicit server-receipt chains for
dependent Daily Record, feeding and zero-activity commands. Cached HTML contains
no authenticated workspace data. Recovery does not renew offline authorization.

The receipt-chain migration also includes feeding sessions in feed revisions.
Dependencies are checked against the same actor, organization, farm, flock and
day; unrelated source changes still conflict. Original command IDs and payload
hashes remain stable for replay. Day closure remains online and authoritative.

Verification so far: all 375 unit/contract tests, lint and TypeScript passed;
the Docker dry run applied 15 forward migrations and passed populated ledger,
authorization, lifecycle and receipt-chain integration checks. A new persistent
browser test covers an entire offline flock day, disconnected reload, browser
restart, reconnect, exact-once stock deduction, day closure and receipt replay.
Its Chrome/Edge/Firefox/WebKit results are pending; they are not certified here.
Interrupted service-worker installation is covered by a unit regression that
preserves the old shell. Physical-device and real upgrade-failure acceptance,
and the seven-day unassisted farm pilot, remain separate open gates.

Staging read-only preflight found exactly one pending migration,
`20261013000000_today_receipt_chains.sql`, with every predecessor present.
No staging mutation or push has yet been performed for this increment.

The full-day browser run has not passed. The first attempts found a missing
production shell marker (fixed in build-level headers) and Windows CacheStorage
failure caused by the long persistent-profile path (test profiles now use a
short, owned temporary directory). A retry then timed out while Today waited
for all offline task details before showing the flock. Today now renders the
authoritative workspace before that preparation finishes. This final UI change
still needs a rebuilt browser check; cross-browser acceptance and deployment
remain blocked. Broad reruns were stopped after the operator raised time/token
concerns. No successful complete offline day is claimed.

## Deferred verification — 2026-10-13

- Full lint, TypeScript and all 371 unit/contract tests passed after fixing the
  initial offline-lock effect. This includes dependency ordering, retry/backoff,
  interrupted-send identity, expiry/skew, authorization pause and draft retention.
- The Next.js production build passed. The local browser runner now uses that
  production path rather than repeatedly compiling development routes.
- The first production-browser attempt selected no tests because of its command
  filter. Discovery with `--grep=Today` now finds exactly one targeted test;
  discovery is checked before the runner creates containers or builds.
- The targeted browser test now also replays the applied command and requires
  the identical server receipt. The corrected Chromium run passed (one test,
  25.7 seconds): English/Amharic tablet portrait and landscape, no horizontal
  overflow, 44px context controls, Ethiopian calendar with unchanged operational
  date, Amharic reload persistence, offline bird-check queue/duplicate-save lock,
  reconnect application and identical receipt replay. Both Amharic screenshots
  were inspected. This is one task, not a complete offline flock day.
- gstack browser startup was blocked by local `EPERM` log-file permissions.
  The existing Playwright runner is the fallback; permissions were not weakened.
- Follow-up review found that a quota failure while enqueueing only showed the
  form error. Outbox storage failures now also activate the global blocking
  recovery message. A populated browser regression covers draft reload, quota
  failure, midnight expiry and revoked farm access. Final Chromium run passed:
  two tests in 1.5 minutes. Real IndexedDB drafts survived an online reload and
  injected outbox quota failure; failure blocked saving without a queued command.
  Simulated next-day expiry disabled editing without deleting the draft. Online
  refresh restored editing. CEO revocation prevented reconnect synchronization,
  retained the queued command and returned HTTP 403 for the revoked farm.
  Initial retries corrected test loading/time-control setup, not application
  authorization rules. Browser-only retries reused the just-built local bundle;
  the checked-in runner still builds normally.

Full-day, physical-device and cross-browser acceptance remain open. No remote
database changes, commit or push are included in this verification.
The runner removed its disposable containers/database after the successful run.

## Current status — 2026-10-12

Today now connects the persistence runtime to its forms: draft restoration,
persist-before-send outbox, foreground reconnect/focus synchronization, current-day
offline grants, expiry locks, global/card states and live announcements. Rejected
or conflicting inputs remain stored until explicitly reviewed/discarded. Partial
health saves preserve other unsent treatment/vaccination inputs. Finish waits for
pending writes and refuses drafts, queued commands or invalid online authorization.

The sections below retain the earlier audit history; their "not wired" statements
describe the application before this integration, not the current implementation.

### Still not full offline-day acceptance

- Protected-page reload/browser restart has no safe offline application shell.
  Static asset caching does not make authenticated HTML available offline.
- Task details must already have been loaded online to be available offline.
- A second pending mutable edit to the same Daily Record/feed day is blocked.
  There is no safe server-receipt revision-chain protocol yet.
- A new day's dependent forms can need a Daily Record ID created by the server.
  One successful offline bird save is not evidence of a complete offline day.
- Physical tablet, Firefox/WebKit, service-worker upgrade failure, screen-reader
  output, browser clock-skew and complete offline-day acceptance remain open.

At the owner's request, Tasks 5.3–5.5 now separate implementation from verification:
their implementation checkboxes are checked, while their verification subitems
remain unchecked. Task 8.2 and pilot readiness are not complete. The full-day
implementation gaps listed above remain release blockers. No migration,
staging/production write, commit or push is part of this follow-up.

The implementation-first follow-up adds explicit retry wakes after direct saves,
draft cleanup before removing applied outbox commands, selected-farm access refresh
before reconnect unlock, sticky worker-registration/upgrade failure reporting and
translated rejection reasons. Regression cases were added; broad browser/build
verification is deferred, not claimed as passed.

### Verification before the implementation-first follow-up

- Full unit/contract suite: 369 passed, zero failures.
- Focused offline/localization suite: 42 passed, zero failures (included above).
- TypeScript, focused ESLint and `git diff --check`: passed.
- Browser retry used a disposable database with yesterday's verified closing
  population (100 birds), preserving the missing-opening-count safeguard. The
  retry failed at sign-in's 90-second navigation timeout before Today checks.
  No successful offline-browser acceptance is claimed.
- Production/Cloudflare build was not rerun for this integration. Earlier builds
  do not certify these changes.

## Earlier scope — 2026-10-10

Acceptance uses the disposable migrated local Docker stack created by
`scripts/test-flock-lifecycle-browser.mjs`. It does not use production or staging
credentials. Browser coverage is Chromium tablet emulation, not a physical
tablet or Firefox/WebKit certification.

## Checks

- Local Next.js production build: passed, including TypeScript, all 100 static
  pages and final trace collection, before the offline-foundation follow-up.
  The follow-up passed focused TypeScript, ESLint and whitespace checks; a new
  full production build has not been run for those follow-up changes.
- Offline adapter/synchronization/foreground unit tests: 18 passed with
  `node --test tests/offline-store.test.mjs tests/offline-sync.test.mjs tests/offline-foreground-sync.test.mjs`.
  These exercise helper behavior, not a complete offline browser workflow.
- Three browser attempts did not pass: cold route/profile timing, an Auth HTTP
  504, then the 240-second test limit while waiting for the profile. Login and
  manager-context reads succeeded in the final attempt. Amharic/Today cases
  were not reached because the runner stops after its first failure. Route
  warm-up did not eliminate development-route recompilation. Further retries
  are paused; no tablet/Amharic acceptance is claimed.
- Added Today portrait/landscape checks for 44px controls, Ethiopian calendar
  values, preserved Gregorian operational date, locale reload persistence and
  the offline initial-bird-save guard. These are unverified browser scenarios.
- gstack browse startup timed out; its server was subsequently stopped.

## Offline release blocker

Full offline-day acceptance cannot pass in the current application. OpenSpec
Tasks 5.3–5.5 remain unchecked. The existing offline store and synchronization
helpers are not connected to Today forms:

- `today-workspace-screen.tsx` loads the workspace from the server without an
  offline snapshot fallback. Its online label does not inspect an outbox.
- `embedded-task-card.tsx` sends commands directly; unsuccessful offline saves
  are not persisted to an outbox. Form changes are not persisted as drafts.
- `bird-check-card.tsx` explicitly requires an internet connection for the
  initial bird save and describes draft storage as a future task.
- The service worker caches only static assets, not an offline Today shell.
  A disconnected protected-page reload is not supported.
- At audit time the synchronization helper had no foreground lifecycle,
  backoff or recovery of interrupted sends. The foundation follow-up below
  addresses those helpers, but they are not yet connected to Today.
- Current-day offline authorization, midnight expiry and locked-draft recovery
  are not integrated into the workspace.

Do not mark Task 8.2, the full offline-day gate or pilot readiness complete.
Do not cache authenticated HTML/API responses to bypass this blocker.

## Offline foundation follow-up

The operator requested implementation of the missing foundation. The first
increment adds persisted capped backoff, same-ID interrupted-send recovery,
single-store drain serialization, independent dependency progress, result
identity checks and session-expiry pause. Persistence failures after server
application surface as blocking errors while preserving recoverable commands.

`foreground-sync.ts` adds reconnect/focus/visibility triggers, cross-tab Web
Locks where available, retry scheduling, explicit online authorization refresh
and cleanup. Optional service-worker Background Sync only signals foreground
clients; it does not cache credentials or perform unverified protected writes.

All 18 foundation regressions passed. Task 5.3 remains in progress: the
controller must still be integrated with Today, alongside Task 5.4 authorization
and Task 5.5 persistent drafts/outbox presentation. No new migration, remote
mutation, commit or push was performed in this acceptance follow-up.

## Required next implementation and acceptance

### 2026-10-10 authorization and persistence increment

- Added server-issued offline grants only for an assigned Farm Manager's open,
  current Addis Ababa operating day. Grants expire at assignment expiry or the
  next Addis midnight, whichever comes first; no historical/CEO/Admin grant.
- Added lease validation for tenant/user/farm/flock, initial clock skew,
  backwards clock changes and expiry. Expiry locks editing without deleting work.
- Added a persistence runtime for workspace/task-detail snapshots, drafts and
  commands. Saves retain original payloads/revisions; conflicting/rejected work
  retains input. Finish is online-only and refuses drafts or outstanding commands.
- Until an explicit revision-chain protocol exists, a second mutable command
  for the same Daily Record/feed day is blocked instead of silently rebased.
  This is an interim safety limitation, not full offline-day support.
- Identity cleanup now waits for IndexedDB deletion and surfaces blocked cleanup;
  sign-out errors no longer leave an unhandled rejection or permanent spinner.
- All 362 unit/contract tests pass, including 26 offline regressions. These are
  not browser-restart or populated offline-day acceptance results.

Today forms and foreground sync are still not wired to this runtime. Tasks
5.3–5.5 remain unchecked. No new migration or remote deployment is needed for
this increment; production and staging were not changed.

Complete Tasks 5.3–5.5 using tenant/user-isolated persistence, an explicitly safe
offline shell, current-server-day authorization and server revalidation. Preserve
drafts on expiry, conflicts, rejected commands and storage/upgrade failures.

Then run a populated complete day: load online; disconnect; record every
required task; reload and restart the browser; reconnect and reauthenticate;
sync sessions before feed close; verify exactly-once stock/operational mutations;
resolve conflicts; finally close online with fresh authoritative revisions.
Repeat for revoked assignment, midnight, quota failure, interrupted sends,
service-worker upgrade and sign-out/identity isolation. Verify all supported
browsers and English/Amharic tablet orientations before pilot acceptance.
