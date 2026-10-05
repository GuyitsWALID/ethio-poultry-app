# Tasks

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
- [ ] 4.6 Migrate the remaining CEO/Farm Manager Feed, Health, Inventory, Sales, Alerts, Governance, Record Checks, and Reports interface text before broad bilingual release; verify missing-key checks and Amharic expansion layouts.
  - [x] Alerts, Action Desk, and notification preferences.
    - [x] Inventory and warehouse workflows.
  - [ ] Feed Control and template management.
  - [ ] Health, vaccination, and mortality workflows.
  - [ ] Sales and expense workflows.
  - [ ] Governance and approval workflows.
  - [ ] Record Checks and guided resolution workflows.
  - [ ] Reports and financial-close workflows.
  - [ ] Cross-module missing-key and Amharic expansion verification.

## 5. Offline Web Foundation

- [x] 5.1 Add the manifest, installable icons, service-worker registration, and secured `/sw.js` headers; verify production build installation criteria and that protected/API routes are not runtime-cached.
- [x] 5.2 Implement the offline-store interface with IndexedDB and in-memory adapters for snapshots, drafts, outbox commands, schema upgrades, and identity cleanup; verify refresh, restart, migration, quota failure, and sign-out tests.
- [ ] 5.3 Implement dependency-aware foreground synchronization and progressive Background Sync with retry/backoff; verify session-before-feed-close ordering, independent-command progress, and blocked-dependent behavior.
- [ ] 5.4 Enforce current-Addis-day offline authorization, reauthentication, assignment refresh, and locked expired drafts; verify midnight, device clock skew, revoked assignment, and offline sign-in scenarios.
- [ ] 5.5 Add global and card-level connection states for Saved on tablet, Waiting to sync, conflict, rejected, and synced results; verify screen-reader announcements and recovery actions.

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
- [ ] 7.5 Consolidate operational analytics under Reports with Production, Feed/FCR, Health/Mortality, Stock/Consumption, and Sales/Finance sections; verify CEO organization totals and Farm Manager assigned-farm totals match the existing source calculations.
  - Implementation deployed to staging on 2026-10-05 and pushed to `notmain`: bilingual five-section Reports, health/treatment/vaccination evidence, farm expenses and financial-close evidence, independently authorized warehouse expenses, and feature-aware legacy analytics handoffs. Existing calculations and correction/configuration/history routes are preserved. Verified with 292 unit tests, TypeScript, focused lint, portrait/landscape Chromium presentation tests, Cloudflare build/dry run, anonymous staging smoke checks, and GitHub Quality gate. No migration needed; production unchanged. Dedicated-account staging runs failed: first run found a bilingual test-selector issue (fixed) and no manager warehouse assignment; corrected run failed but assertion retrieval hit GitHub network timeouts. See `docs/deployment/consolidated-reports.md`. Keep unchecked until the remaining failures are reviewed and populated staging CEO/assigned-manager source comparisons pass; broader authenticated end-to-end validation remains under 8.3.
- [ ] 7.6 Keep Feed template management as configuration and retain compatible legacy URLs during the pilot; verify rollback by disabling Today returns the original navigation and routine-entry behavior.

## 8. Verification and Pilot Readiness

- [ ] 8.1 Run migration verification, RLS tests, SQL integration tests, focused Today/offline/localization tests, the full test suite, lint, TypeScript, and production build; record exact commands and passing results.
- [ ] 8.2 Run Playwright in tablet portrait and landscape across Chromium plus supported cross-browser projects, including offline/reconnect, Amharic, deep-link, accessibility, and legacy-route regression scenarios.
- [ ] 8.3 Apply migrations and feature-disabled code to staging, run Cloudflare/Supabase end-to-end validation, and verify rollback by disabling the tenant feature flag.
- [ ] 8.4 Produce an encrypted logical production backup, complete and document a restore drill, name the rollback owner, and verify daily backup monitoring before enabling authoritative pilot data.
- [ ] 8.5 Enable Today only for the isolated production pilot organization and verify monitoring, notifications, command receipts, and legacy fallback routes.
- [ ] 8.6 Conduct a silent full-day usability test and seven consecutive unassisted operating days; verify no lost/duplicate/incorrect mutations and resolve every confusion repeated on two or more days.
- [ ] 8.7 After pilot acceptance, create a separate reviewed OpenSpec change for CEO primary-navigation simplification using the approved Today status, Needs attention, Performance, and Approvals model.
