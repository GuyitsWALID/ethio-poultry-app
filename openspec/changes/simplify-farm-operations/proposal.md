# Proposal

## Why

EthioPoultry already supports the farm's core operational workflows, but Farm Managers must understand software modules and technical vocabulary to complete one day of work. The first committed pilot needs one plain, bilingual, tablet-friendly workflow that remains safe during intermittent connectivity without weakening the existing authoritative ledgers.

## What Changes

- Add a Farm Manager **Today** workspace that derives required jobs for every active flock and coordinates daily records, feed, health, routine supplies, stock, sales, expenses, assigned fixes, review, and operating-day close.
- Replace the Farm Manager's module-heavy primary navigation with Today, Flocks, Stock, Sales, Alerts, and History & More while preserving all existing routes and deep links.
- Add English and Amharic preferences and translated Farm Manager and CEO interfaces; keep Admin English-only.
- Add offline-capable Today drafts and an idempotent command outbox for previously authorized work, with visible sync/conflict states and online-only final close.
- Add a server-only Today orchestration module, per-resource concurrency tokens, task attestations for explicit zero/none work, and transactional command receipts.
- Roll the workflow out behind a tenant feature flag, validate it on staging, then pilot it with one isolated production organization before simplifying the CEO workspace.
- Preserve all existing Feed, Health, Inventory, Sales, Governance, Record Check, Action Desk, and audit ledgers as the authoritative sources.

## Capabilities

### New Capabilities

- `farm-manager/today-workspace`: Derives daily jobs and completion from authoritative records and provides a single guided Review and Finish workflow.
- `farm-manager/offline-commands`: Stores current-day drafts on the device and synchronizes authorized, versioned, idempotent commands without duplicate mutations.
- `localization/bilingual-operations`: Provides persistent English and Amharic interfaces, stable localized message codes, and locale-aware operational formatting.
- `navigation/simplified-operations`: Presents role-appropriate primary navigation while retaining advanced workflows and compatible deep links.

### Modified Capabilities

None. This repository has no existing OpenSpec capability inventory; existing application behavior is preserved and referenced by the new capability specifications.

## Impact

- Adds a new Today route, client workspace, localization provider, service worker, IndexedDB outbox, and PWA manifest/assets.
- Adds `GET /api/farm-manager/today` and `POST /api/farm-manager/today/commands` over a deep orchestration interface shared with existing domain logic.
- Adds database support for locale preference, command receipts, explicit daily task attestations, feature rollout, resource revisions, and atomic Finish day validation.
- Changes Farm Manager navigation and post-login routing; later changes the CEO navigation after the manager pilot passes.
- Adds `next-intl` and pins OpenSpec tooling. Existing operational URLs, histories, permissions, and ledger semantics remain compatible.
