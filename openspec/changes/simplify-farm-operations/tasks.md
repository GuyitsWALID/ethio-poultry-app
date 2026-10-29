# Tasks

## Current completion boundary — 2026-10-24

Implementation is not the same as pilot certification. Today, offline recovery,
shared warehouse access, Flocks, History and Farm performance are implemented.
The owner confirmed the deployed Feed/Sales repair and the offline staging flow.
Task 4.6's legacy/configuration/correction localization implementation is complete;
its integrated verification is deferred. Release acceptance and the real
seven-day pilot remain Task 8.
See `completion-checkpoint.md` for current evidence and remaining work. Older
dated notes below are retained as history, not renewed implementation blockers.

### Linked History navigation revision (2026-10-18)

`unify-operational-history` supersedes the presentation described in 7.1 with Today, Flocks, Alerts, History, Reports and More (Approvals, Record Checks, Feed templates). It also documents the approved narrow exception to 7.4: enabled CEOs receive History and consolidated Approvals without activating the broader CEO workspace. Legacy routes, disabled-tenant navigation and the pilot acceptance gate remain intact. Verification of this revision is tracked in that linked change, not inferred from the older checked tasks below.

## 1. Planning and Baseline Safety

- [x] 1.1 Install OpenSpec 1.13.1 globally, pin it as an exact development dependency, initialize Codex integration, disable telemetry, and verify `openspec --version` and project context resolve.
- [x] 1.2 Create and strictly validate the `simplify-farm-operations` proposal, design, capability specs, and implementation tasks with `openspec validate simplify-farm-operations --strict`.
- [x] 1.3 Preserve the existing Manager Dashboard date-filter work as a separate diff and verify its focused tests still pass before touching shared shell or routing files.
- [x] 1.4 Audit the new dependency tree with `npm audit`, document which advisories are introduced or pre-existing, and verify no unsafe automatic upgrade is applied.

## 2. Database Foundation

- [x] 2.1 Add a migration for `profiles.preferred_locale`, organization Today/CEO feature flags, `client_operation_receipts`, and `daily_task_attestations`; verify constraints, indexes, comments, and additive upgrade behavior with migration tests.
- [x] 2.2 Add tenant-scoped RLS and grants so receipts and attestations are accessible only through authorized server operations; verify CEO, assigned manager, out-of-scope manager, System Admin, and cross-tenant cases.
- [x] 2.3 Add canonical payload hashing, receipt replay, task-attestation, source-fingerprint, and per-resource revision database helpers; verify same-payload replay and changed-payload rejection in SQL integration tests.
- [x] 2.4 Add a versioned atomic Finish day function that locks and revalidates the operating day before delegating to existing close behavior; verify concurrency, stale revision, missing work, repeated close, and no-active-flock cases.
- [x] 2.5 Regenerate or safely update Supabase types and verify `npm run typecheck` recognizes the new columns, tables, and functions.

## 3. Deep Today Module

- [x] 3.1 Define the closed version-1 Today workspace and discriminated command contracts, stable error codes, and revision rules; verify contract tests reject unknown versions, commands, and invalid payloads.
- [x] 3.2 Implement `loadTodayWorkspace` with assignment filtering, lifecycle-aware flock applicability, readable context, authoritative prefilling, and derived task states; verify layer, broiler, partial-lifecycle, backdated, and no-active-flock cases through the module interface.
- [x] 3.3 Extract shared domain operations from existing route handlers without changing behavior, and verify legacy route tests still pass for Daily Records, Feed, Health, Mortality, Inventory, Sales, Expenses, and Action Desk.
- [x] 3.4 Implement `executeTodayCommand` dispatch for daily records, feed sessions/close, mortality, health/vaccination, no-activity attestations, inventory receipts, sales, expenses, assigned actions, and Finish day; verify each command uses the authoritative operation and transaction boundary.
- [x] 3.5 Add `GET /api/farm-manager/today` as a thin adapter with private/no-store headers and assignment-safe error handling; verify unauthorized targets reveal no scoped data.
- [x] 3.6 Add `POST /api/farm-manager/today/commands` as a thin adapter with idempotency, authorization, structured conflict/rejection results, and stable message codes; verify retry, stale assignment, lock, stock, category, and revision cases.

## 4. Localization Foundation

- [x] 4.1 Install and configure `next-intl` for preference-based `en` and `am` operation without locale URL prefixes; verify existing authenticated URLs remain unchanged.
- [x] 4.2 Add typed shared and Today message catalogs plus locale/date/number/ETB helpers fixed to `Africa/Addis_Ababa`; verify catalog parity and locale formatting tests.
- [x] 4.3 Add the CEO/Farm Manager English/Amharic header control, profile persistence, offline device fallback, and Admin exclusion; verify immediate switching, reload persistence, and Admin English-only behavior.
- [x] 4.4 Build and partner-review the poultry terminology glossary using the selected Amharic references; verify every manager-facing Today term has an approved English and Amharic entry.
- [ ] 4.5 Migrate Farm Manager navigation, Today, validation, notifications, loading, empty, success, and error text to catalog keys; verify the hard-coded-string check and translated browser tests pass.
  - [x] Core Today/navigation/notification catalog migration and stable message mappings implemented. On 2026-10-24, bird, health and embedded saves were aligned with the full shared error map; assigned-fix status badges now reuse translated notification statuses.
  - [x] Add a CI-enforced AST regression for visible Today text, accessible labels and static translation keys; preserve the existing English/Amharic key-parity and Ethiopian-calendar tests.
  - [ ] Final rebuilt signed-in translated browser acceptance for the current integrated release. Earlier scoped tablet/browser evidence remains valid history but is not a new full-release sign-off.
- [ ] 4.6 Migrate the remaining CEO/Farm Manager Feed, Health, Inventory, Sales, Alerts, Governance, Record Checks, and Reports interface text before broad bilingual release; verify missing-key checks and Amharic expansion layouts.
  - 2026-10-29 implementation phase: migrated operational controls, dynamic states, auxiliary panels and compatibility Reports; added explicit catalogs for generated analytics/mortality explanations, all 22 Record Check rules, exact-source correction guidance, authoritative operation validation, Feed configuration validation and AI error codes. Amharic dates reuse the Ethiopian calendar; wire dates, status codes, calculations and access checks remain unchanged. New AI analyses are language-scoped in their evidence hash; frozen analyses and original names/notes/evidence are not rewritten. Implementation checkboxes below do not certify the release: new tests, type/lint/build checks, signed-in browser acceptance and partner terminology review remain deferred at the user's request. No staging deployment or production approval is implied.
  - [x] Alerts, Action Desk, and notification preferences.
    - [x] Inventory and warehouse workflows.
  - [x] Feed Control and template management implementation; integrated verification deferred.
    - [x] Shared weight-entry sheet: bilingual fields/status/fallback messages, locale-formatted targets, Ethiopian-calendar date entry and 48px controls. Focused regression covers visible text, catalog parity and unchanged mutation payload; live layout acceptance remains open.
    - [x] Shared approved feed-template review: catalog headings/counts, existing bilingual feed types and locale number formatting; real English/Amharic rendering regressions. Main Feed Control/configuration implementation is now migrated; integrated verification remains open.
    - [x] Feed-template editor controls, approval guidance, import/save feedback, accessible row labels and version history translated; version and weight-check dates use the Ethiopian calendar in Amharic. Weight-check list labels/statuses, generated Feed KPI/exceptions and template validation now use catalogs. Existing names and mutation values remain unchanged. Tablet layout acceptance is still pending.
  - [x] Health, vaccination, and mortality workflow implementation; generated investigations, chart legends and completion feedback included.
  - [x] Sales and expense workflow implementation; chart captions, financial states, cost-source descriptions and core validation included.
  - [x] Governance and approval workflow implementation; field labels, audit controls, counts and feedback included. Immutable request evidence remains in its original language.
  - [x] Record Checks and guided resolution implementation; auxiliary assignment/AI panels, rule guidance, source labels, verification explanations and Ethiopian deadline dates included.
  - [x] Reports and financial-close presentation implementation; compatibility report sections, CSV headings, date/number formatting, generated explanations and live/saved multi-farm scope captions included. Business calculations and old snapshot contents remain unchanged.
    - [x] Farm performance primary monetary cards reuse the shared ETB formatter in both locales, without duplicate currency units. Real-render regression covers positive/zero/negative amounts, missing evidence and non-money units; integrated staging acceptance remains separately gated.
  - [ ] Cross-module missing-key and Amharic expansion verification.
    - 2026-10-29 local checks passed: 551 tests, TypeScript, zero-warning lint, production build, Cloudflare build, 97-file migration contract and 33 browser-test discovery. Final focused catalog/calendar/AI regressions: 23 passed. User chose GitHub staging accounts for post-push signed-in tablet/locale acceptance; that gate now includes a dedicated bilingual operational-screen test. See `docs/deployment/localization-verification-2026-10-29.md`. Final staging and partner terminology acceptance are not marked complete.

## 5. Offline Web Foundation

2026-10-14 acceptance update: owner manually tested the localhost offline workflow
and confirmed everything working. Task 5 implementation is complete and accepted
for staging. Earlier notes below are retained as verification history, not current
implementation blockers. This owner confirmation is not automated cross-browser,
physical-tablet, upgrade-failure or seven-day production-pilot certification;
unverified scenarios remain tracked for release/pilot acceptance.

- [x] 5.1 Add the manifest, installable icons, service-worker registration, and secured `/sw.js` headers; verify production build installation criteria and that protected/API routes are not runtime-cached.
- [x] 5.2 Implement the offline-store interface with IndexedDB and in-memory adapters for snapshots, drafts, outbox commands, schema upgrades, and identity cleanup; verify refresh, restart, migration, quota failure, and sign-out tests.
- [x] 5.3 Implement dependency-aware foreground synchronization and progressive Background Sync with retry/backoff.
    - 2026-10-14: explicit receipt references now chain Daily Record creation/edits, feeding sessions, feed close and zero confirmations. Source revisions and fingerprints remain checked server-side; the Docker migration/integration dry run passed. Full-day cross-browser acceptance is running, not yet certified.
    - [ ] Deferred verification: session-before-feed-close ordering, independent-command progress, blocked dependents, interrupted sends and retry recovery in the populated browser workflow.
    - 2026-10-12 deferred verification: full lint, TypeScript and 371 unit/contract tests pass, including dependency ordering, independent progress, retry/backoff, same-ID interrupted sends and authorization pause. These helper results do not replace populated browser acceptance.
    - 2026-10-12: foreground synchronization is wired into Today, with persisted retry/backoff, same-ID interrupted-send recovery, authorization refresh, dependency ordering, independent-command progress and optional service-worker wake signals. Complete populated offline-day/browser acceptance remains open; multiple pending edits to the same mutable resource are safely blocked rather than silently rebased.
- [x] 5.4 Enforce current-Addis-day offline authorization, reauthentication, assignment refresh, and locked expired drafts.
    - [x] Chromium verification: simulated next-day expiry locks editing and preserves drafts; online refresh restores editing; actual CEO farm revocation preserves the queued command and blocks reconnect synchronization (revoked workspace returns HTTP 403).
    - [ ] Deferred verification: browser device-clock skew and offline sign-in scenarios; new safe offline reload/restart implementation awaits populated cross-browser acceptance.
    - 2026-10-14: data-free offline shell, preloaded authorized forms and identity-scoped restart recovery implemented. Recovery preserves the original grant and cannot renew authorization or sign in offline.
    - 2026-10-12: Today editing uses server-issued current-Addis-day/assignment-expiry grants, tenant/user/farm/flock checks, expiry locks and online session/assignment refresh before synchronization. Expired drafts remain stored. Protected offline reload/browser restart and populated revocation/midnight browser acceptance remain open.
- [x] 5.5 Add global and card-level connection states for Saved on tablet, Waiting to sync, conflict, rejected, and synced results.
    - [x] Chromium verification: real IndexedDB draft recovery after online reload, injected outbox quota failure with blocking recovery message and no queued command, plus retained input through expiry/revocation. Fixed storage failures not activating the global recovery message.
    - [ ] Deferred verification: screen-reader announcements, translated rejection reasons and service-worker upgrade failures in the browser; complete offline-day recovery remains open.
    - [x] Scoped Chromium tablet verification: English/Amharic context controls, Ethiopian calendar, locale reload persistence, offline bird-check queue, duplicate-save lock, reconnect application and identical command-receipt replay. Production build passed; this does not complete the broader verification items or a full offline day.
  - 2026-10-12: Today forms persist drafts and queue commands before transport. Global/card states, live announcements, snapshot fallback within the loaded app, stale-input review, explicit discard confirmation and storage-error recovery are wired. Partial health saves preserve other unsent forms. Full offline-day recovery acceptance is still open; see `docs/deployment/tablet-offline-acceptance.md`.
  - Owner requested implementation-first delivery: 5.3–5.5 parent checkboxes track implementation; automated verification gaps remain explicitly unchecked above and under 8.1–8.2. Follow-up fixes wake retries after direct saves, retain command IDs through local cleanup failure, recheck selected-farm access before reconnect unlock, surface early/service-worker upgrade failures, and show translated rejection reasons. Owner subsequently confirmed manual offline testing and authorized staging migration and `notmain` push; production pilot remains separately gated.

## 6. Today User Experience

- [x] 6.1 Add the dedicated Today route with assigned farm/date/flock context, progress summary, feature-flag behavior, and responsive tablet layout; verify portrait, landscape, keyboard, and 44-pixel touch-target checks.
- [x] 6.2 Implement a lazy, assignment-safe task-detail read interface at `GET /api/farm-manager/today/tasks/[task]`; verify every task returns only its authoritative current values, allowed choices, dependencies, revisions, and correction destinations.
- [x] 6.3 Implement the expandable Check birds card with authoritative opening values, the movement equation, field guidance, and focused save; water is excluded and recorded once under Eggs and water. Verify zero movements, imbalance, missing source, draft, conflict, collapse, and auto-advance.
- [x] 6.4 Implement the expandable Record feeding card over existing scheduled sessions and feed close; verify plan completion, inventory selection, missed-session reasons, one-time deduction, reopen effects, collapse, auto-advance, and offline dependency ordering.
- [x] 6.5 Implement the expandable Eggs and water card so water applies to every flock while egg fields appear only for layer/parent-stock flocks; verify classification totals, focused Daily Record preservation, collapse, and auto-advance.
- [x] 6.6 Implement the expandable Health and deaths card with explicit no-activity confirmation and conditional mortality, treatment, medicine, vaccination, warehouse, and quantity fields; verify atomic stock rollback, category restrictions, collapse, and auto-advance.
- [x] 6.7 Implement the expandable Routine supplies card with explicit nothing-used confirmation and repeatable eligible usage rows; verify feed, medicine, and vaccine items remain excluded and unrelated Daily Record values are preserved.
- [x] 6.8 Implement directly editable Stock receipts and scheduled counts, Sales, Expenses, and Assigned fixes cards in Today; verify optional work does not silently block close, assigned work remains visible, and every mutation uses the existing authoritative operation.
- [x] 6.9 Implement Review and Finish day with complete/missing/queued/rejected/conflict summaries and online atomic close; verify concurrent mutation, stale revision, retry, already-closed, and offline behavior.
- [x] 6.10 Update normal Daily Records, Feed, Health, Mortality, Stock, Sales, and Expense create actions to open the exact Today card for enabled managers while keeping history, configuration, governed corrections, and alert deep links intact.
- [x] 6.11 Add one-open-card-at-a-time behavior, collapsed authoritative summaries, successful-save auto-advance, short first-use bilingual guidance, and contextual examples; verify guidance can be dismissed and reopened and never blocks experienced users.

## 7. Simplified Navigation and Rollout

- [x] 7.1 Implement feature-aware Farm Manager navigation with Today, Flocks, Alerts, and History & More; place Daily Record, Feed, Health, Mortality, Stock, Sales, Expenses, Governance, Record Checks, and assigned-farm Reports under History & More and verify every legacy authorized destination remains reachable.
- [x] 7.2 Change Farm Manager post-login routing to Today only for enabled organizations; verify disabled organizations retain the current dashboard and trusted destinations remain intact.
- [x] 7.3 Add pilot feature-management controls and audit evidence for Today enablement; verify only authorized CEO/system release operations can change rollout state. Verified locally with CEO/release/direct-write Docker rollback tests, sanitized tenant-scoped history, and portrait/landscape bilingual browser controls. See `docs/deployment/today-rollout.md`; migration `20261005000000` applied to staging on 2026-10-05 with preflight and three rollback regression suites passing. Full staging end-to-end validation remains under 8.3.
- [x] 7.4 Leave CEO navigation unchanged during the manager pilot except for localization, and record the CEO simplification as a gated follow-up; verify `simplified_ceo_workspace` cannot activate before the pilot gate. CEO destination contract and fail-closed INSERT/UPDATE gate verified locally with 274 unit tests and three Docker rollback suites. See `docs/deployment/ceo-simplification-gate.md`; forward migration `20261005001000` applied to staging on 2026-10-05 with preflight and three rollback regression suites passing. Acceptance/release boundary remains a separate reviewed Task 8.7 change after real pilot evidence; full staging end-to-end validation remains under 8.3.
- [x] 7.5 Consolidate operational analytics under Reports with Production, Feed/FCR, Health/Mortality, Stock/Consumption, and Sales/Finance sections; verify CEO organization totals and Farm Manager assigned-farm totals match the existing source calculations.
  - Implementation deployed to staging on 2026-10-05 and pushed to `notmain`: bilingual five-section Reports, health/treatment/vaccination evidence, farm expenses and financial-close evidence, independently authorized warehouse expenses, and feature-aware legacy analytics handoffs. Existing calculations and correction/configuration/history routes are preserved. After the operator approved explicit staging permission for the shared DEMO Addis Central Farm Store, protected run `37488388925` passed both populated CEO and Farm Manager comparisons across all five sections, including stock and effective-access reader agreement, on 2026-10-06. Current full unit suite: 299 passed; TypeScript, lint, tablet presentation checks and GitHub Quality gate passed. See `docs/deployment/consolidated-reports.md` and the separate `inherit-farm-warehouse-access` evidence. Production unchanged; broader authenticated end-to-end and rollback validation remains under 8.3.
- [x] 7.6 Keep Feed template management as configuration and retain compatible legacy URLs during the pilot; verify rollback by disabling Today returns the original navigation and routine-entry behavior. Exact historical batch targets now remain selected rather than silently switching to an active batch. Local unit and portrait/landscape Chromium regressions verify template/version access, correction/history links, original manager navigation and Feed entry with Today disabled, and unchanged CEO navigation. See `docs/deployment/legacy-workspace-compatibility.md`; live staging feature-disable verification remains under 8.3. No migration or rollout-state change included.

## 8. Verification and Pilot Readiness

### Approved navigation gap repair (2026-10-24)

- [x] Share manager destination rules across Alerts, notification bell, Today assigned fixes and Flock next steps; keep routine work in Today, past evidence in History and analysis in Farm performance.
- [x] Retain exact correction/approval/configuration targets and CEO/Admin/disabled behavior; isolate Feed templates and weight checks from the routine Feed dashboard.
- [x] Add regressions for routing, historical/invalid scope, operating windows, offline caller compatibility and focused Feed presentation (532 unit tests passing). See `navigation-gap-repair.md`.
- [ ] Verify the repaired links in signed-in staging tablet/Amharic and feature-disabled sessions before release acceptance.

- [ ] 8.1 Run migration verification, RLS tests, SQL integration tests, focused Today/offline/localization tests, the full test suite, lint, TypeScript, and production build; record exact commands and passing results.
- [ ] 8.2 Run Playwright in tablet portrait and landscape across Chromium plus supported cross-browser projects, including offline/reconnect, Amharic, deep-link, accessibility, and legacy-route regression scenarios.
  - Offline reload/restart shell, preloaded task details and receipt-based dependency chaining are implemented (2026-10-14). Owner confirmed localhost offline acceptance and subsequently reported the staging deployment tested. Remaining gate is documented cross-browser/device/upgrade-failure acceptance, not reimplementation of those features. Never bypass revision checks or cache authenticated HTML/API responses.
- [ ] 8.3 Apply migrations and feature-disabled code to staging, run Cloudflare/Supabase end-to-end validation, and verify rollback by disabling the tenant feature flag.
- [ ] 8.4 Produce an encrypted logical production backup, complete and document a restore drill, name the rollback owner, and verify daily backup monitoring before enabling authoritative pilot data.
- [ ] 8.5 Enable Today only for the isolated production pilot organization and verify monitoring, notifications, command receipts, and legacy fallback routes.
- [ ] 8.6 Conduct a silent full-day usability test and seven consecutive unassisted operating days; verify no lost/duplicate/incorrect mutations and resolve every confusion repeated on two or more days.
- [ ] 8.7 After pilot acceptance, create a separate reviewed OpenSpec change for CEO primary-navigation simplification using the approved Today status, Needs attention, Performance, and Approvals model.
