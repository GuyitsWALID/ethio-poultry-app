# Design

## Context

See `proposal.md` for motivation and the four delta specs for behavior. The application is Next.js 16.3 on Cloudflare with Supabase/PostgreSQL. It already has role-scoped access, a Farm Manager dashboard, atomic `save_daily_record_with_usage`, authoritative `close_feed_day`/`reopen_feed_day`, atomic inventory and health functions, Action Desk assignments, Governance, Record Checks, and `close_farm_operating_day`.

The existing Farm Manager entry form and sidebar expose those database-oriented modules directly. The application has no localization provider, service worker, IndexedDB outbox, or command-receipt contract. Existing Manager Dashboard date-filter changes are uncommitted and must be preserved.

## Goals / Non-Goals

**Goals:**

- Put high-frequency Farm Manager work behind one deep Today module with a small read/command interface.
- Reuse existing ledger functions and their audit, lock, stock, and RLS rules.
- Make task applicability and completion deterministic and testable through the Today interface.
- Provide safe current-day offline capture without treating the browser as authoritative.
- Introduce bilingual presentation without translating stored evidence or domain keys.
- Support a tenant-scoped pilot and reversible rollout.

**Non-Goals:**

- Replacing Feed, Health, Inventory, Sales, Governance, Record Checks, or Action Desk ledgers.
- Offline authentication, offline final close, or multi-day offline operation.
- Deleting legacy routes during the pilot.
- Translating Admin or user-entered evidence.
- Shipping the redesigned CEO information architecture before the manager pilot passes.
- Adding audio guidance in this change.

## Decisions

### 1. Place one deep Today module at the orchestration seam

Create a server-only `today-workspace` module with two public operations:

```ts
loadTodayWorkspace(context, selection): Promise<TodayWorkspace>
executeTodayCommand(context, command): Promise<TodayCommandResult>
```

The implementation owns applicability, presentation-safe labels, state derivation, resource revisions, message codes, command dispatch, and Finish day readiness. Routes are thin adapters. Existing source pages and the Today command dispatcher must call shared domain functions rather than calling each other over HTTP.

This provides leverage and locality: a caller does not need to understand every ledger, and tests exercise the same interface used by both route adapters. A separate pass-through module per Today card is rejected because it would repeat the existing shallow module structure.

### 2. Derive task completion; store only explicit attestations

Today does not add an independent completion ledger. Bird, egg, water, feed, health, mortality, stock, sales, expense, and action results remain derived from their authoritative tables.

Absence is ambiguous for zero health events, zero deaths, and no routine supplies. Add `daily_task_attestations` with organization, farm, nullable flock, work date, task code, source fingerprint, actor, and timestamps. A new attestation supersedes the previous attestation for the same scope. Completion requires both the attestation and a matching source fingerprint, so a later source mutation invalidates it.

Applicable flock work is computed using placement, transfer, closure, and archival dates. An active layer/parent-stock day includes eggs; other supported flock types do not. Optional farm cards do not block close unless an authoritative draft, failed required action, or governing rule makes them incomplete.

### 3. Use per-resource optimistic concurrency

The Today read result contains resource revisions calculated from immutable IDs, relevant `updated_at` values, and source fingerprints. Mutable commands require their target revision. Append-only events do not require a mutable revision but still require command idempotency and current authorization. Feed close and Finish day require their corresponding close/day revision.

A single workspace-wide revision is rejected because unrelated updates would create false conflicts. Optional `expected_resource_revision` is accepted only for append-only command types; the dispatcher rejects a missing revision for mutable commands.

### 4. Enforce idempotency inside PostgreSQL transactions

Add `client_operation_receipts` with a unique `(org_id, actor_id, command_id)`, schema version, command type, canonical payload hash, sanitized result, and timestamps. Each mutating database function receives command identity and performs receipt check, payload comparison, domain mutation, and result persistence in one transaction.

The same ID and hash returns the stored result. A changed hash fails. There is no durable `in_progress` state because the receipt and mutation commit together. Commands that cannot be kept within the database transaction are not eligible for offline queuing in this release.

The dispatcher maps version-1 commands to shared domain operations:

- `save_daily_record` → Daily Record plus routine usage transaction.
- `save_feed_session` → feed-session mutation.
- `close_feed_day` → canonical feed close and inventory issue.
- `record_mortality_event` → mortality event mutation.
- `record_health_event` and `complete_vaccination` → atomic event/inventory functions.
- `confirm_no_activity` → task attestation.
- `record_stock_receipt` → atomic inventory receipt.
- `record_sale` and `record_expense` → existing financial mutations.
- `update_assigned_action` → Action Desk transition.
- `finish_operating_day` → atomic day revalidation and close.

Command schemas are discriminated and validated server-side. The database stores only sanitized results, not localized prose.

### 5. Make Finish day one atomic database decision

Add a versioned Finish day function that locks the farm operating-day row, re-resolves every applicable flock, verifies Daily Record and feed closure evidence, verifies required attestations against source fingerprints, checks pending required actions, and compares the supplied day revision. It closes through the existing operating-day semantics or returns structured gap codes. The UI Review state is advisory and cannot close a day itself.

### 6. Use IndexedDB as a replaceable local adapter

The client offline module exposes a small interface for Today snapshots, drafts, commands, and identity cleanup. IndexedDB is the production adapter; tests use an in-memory adapter. Data is keyed by organization, user, farm, date, and command ID.

Queue states are `draft`, `queued`, `syncing`, `applied`, `conflict`, `rejected`, and `blocked`. Commands may declare dependencies. Foreground sync is the baseline. Background Sync is registered only where supported. The service worker caches versioned shell/static assets and the Today route shell, but it never runtime-caches private API responses, Admin pages, Governance evidence, or audit evidence.

At the next Addis Ababa date, editing is locked pending online reauthentication. Unsynced evidence remains stored but unreadable through the Today UI until identity and assignment are revalidated. Sign-out sends a client cleanup event before ending the session. The pilot requires a dedicated browser profile and OS device lock because browser storage encryption cannot independently defend an unlocked device profile.

### 7. Introduce preference-based localization

Use `next-intl` with `en` and `am` typed message catalogs and no locale URL prefix. A request/provider adapter resolves locale from the authenticated profile, then the local device preference, then English. Add `preferred_locale` to `profiles` with an `en|am` constraint.

Locale keys are grouped by shared, Today, Feed, Health, Inventory, Sales, Alerts, Governance, Record Checks, and Reports. Server results use stable `error_code`/`error_params`; current English `error` strings remain during migration for legacy pages. User evidence remains unchanged. A static catalog parity test and a targeted hard-coded-string check protect translated routes.

### 8. Gate navigation and Today by organization

Add organization feature settings for `today_workspace` and later `simplified_ceo_workspace`. The Farm Manager route map becomes Today-first only when `today_workspace` is enabled. Otherwise the current dashboard remains the landing page. Existing route authorization in middleware remains intact.

The simplified sidebar uses Today, Flocks, Stock, Sales, Alerts, and History & More. History & More contains current module routes. Deep links are never rewritten. The CEO receives the locale control in the first release, but CEO navigation changes only after the pilot gate and a separate feature flag.

### 9. Use a plain, tablet-first interaction pattern

Today is a dedicated route, not a replacement giant modal. Each card has one main action and a focused sheet. Farm/date/flock context precedes input. Small option sets use large buttons; conditional details appear only after a relevant answer. All primary controls meet the 44-pixel touch minimum and work in portrait, landscape, keyboard, and screen-reader use.

The Daily Records history editor remains available for correction. Its normal entry action links to Today for enabled tenants.

## Risks / Trade-offs

- **Offline business data remains in browser storage** → Cache the minimum fields, isolate by identity, block offline sign-in, require device lock/dedicated profile, clear on sign-out, and never cache protected evidence.
- **Legacy routes can race Today** → Require resource revisions for mutable commands and atomically revalidate Finish day.
- **A generic command endpoint could become shallow or unsafe** → Keep a closed versioned command union and dispatch inside the deep module to shared domain operations.
- **Translation can drift from poultry usage** → Maintain a reviewed glossary, require bilingual partner approval, and fail CI on catalog gaps.
- **Service-worker updates can strand commands** → Version local schemas, upgrade storage transactionally, activate only after outbox compatibility checks, and preserve the outbox on failure.
- **A production pilot uses authoritative data without managed Supabase backups** → Block enablement until an encrypted logical backup, restore drill, daily backup schedule, and rollback owner are verified.
- **Scope is large** → Ship behind feature flags in ordered phases and retain the current interface until each gate passes.
- **Browser capabilities vary** → Depend only on service workers, IndexedDB, and foreground synchronization; installation and Background Sync remain enhancements.

## Migration Plan

1. Preserve the existing Manager Dashboard changes and commit OpenSpec/tooling separately from product code.
2. Add dependency, locale catalogs/provider, database schema, RLS, typed database definitions, Today contracts, and unit tests with all feature flags off.
3. Add the read-only Today workspace and simplified navigation behind `today_workspace`.
4. Add transactional command receipts, attestations, shared domain functions, and online command execution.
5. Add IndexedDB drafts/outbox, service worker, manifest, synchronization, and recovery UI.
6. Add required daily cards, then optional stock/sales/expense/action cards, then atomic Review and Finish day.
7. Run migration/RLS/integration/unit/browser/build checks against local Supabase and staging. Verify no legacy route regression.
8. Create an encrypted pre-pilot logical backup and pass a restore drill. Enable the staging tenant and complete tablet/offline QA.
9. Enable only the isolated production pilot organization. Retain legacy routes and take daily logical backups.
10. Disable the feature flag for UI rollback. Database additions and historical receipts/attestations remain in place because they are additive and auditable.
11. After seven accepted operating days, plan and enable the CEO navigation simplification separately.

## Open Questions

None. Amharic wording remains subject to terminology review, but that review selects copy within the specified behavior and does not change the architecture or task breakdown.
