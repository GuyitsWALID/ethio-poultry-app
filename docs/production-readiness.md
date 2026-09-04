# EthioPoultry production-readiness gates

This document is the release checklist for moving EthioPoultry from a functional pilot to a governed production system. A launch-critical gate is complete only when its automated checks and operational evidence both pass.

## Release policy

- Missing operational data is unavailable, never zero.
- A user may only mutate records explicitly owned by their role.
- Every inventory, financial, flock-population, feed-close, and record-deletion mutation must be attributable.
- Production deployments must be reproducible from the locked repository without interactive steps.
- Restore capability must be tested; the existence of a backup is not sufficient.

## Launch-critical gates

### 1. Automated verification

Status: complete

- [x] Locked dependency installation through `npm ci`
- [x] Full lint command with zero warnings
- [x] TypeScript verification command
- [x] Calculation test command
- [x] GitHub Actions quality gate
- [x] Executive calculation regression tests
- [x] Route authorization integration tests
- [x] Feed close/reopen database integration tests
- [x] Daily Record synchronization database integration tests
- [x] Browser tests for every supported role
- [x] Production build independent of remote font downloads

Run the local gate with:

```bash
npm run check
npm run test:db:integration
npm run test:browser
npm run build
```

The database suite creates isolated fixtures inside one transaction and rolls
them back. The browser suite covers anonymous access plus CEO, Farm Manager,
and System Administrator journeys, including positive and denied API calls.
The protected staging gate requires dedicated staging credentials for all three
supported roles.

### 2. Permissions and separation of duties

Status: complete

- CEO/Manager: company-wide oversight, configuration, approval, and reconciliation; no routine operational entry
- Farm Manager: operations for explicitly assigned farms and warehouses
- System Administrator: platform onboarding and support; tenant access only through active CEO-approved break glass

Veterinarian and storekeeper are retired roles and deny access until explicitly reassigned. Branch membership alone does not authorize farm operations.

The permission matrix must be enforced in route handlers and database policies. UI visibility is not an authorization control.

### 3. Operational reconciliation

Status: complete

Required controls:

- Flock opening-to-closing bird ledger
- Feed sessions, closed feed days, daily synchronized totals, and stock issues
- Daily mortality totals and cause-event allocation
- Egg output, classified eggs, and egg sales
- Ledger stock versus physical counts
- Cost allocation and profit-period lock status
- Active batch, flock, farm, and house lineage

### 4. Deterministic deployment

Status: complete

- [x] Environment and release-identity validation
- [x] Self-hosted Fraunces and IBM Plex Sans application fonts
- [x] Cryptographically locked migration-chain verification
- [x] Verified data-free production baseline for empty environments
- [x] Canonical 14-digit migration history and metadata-only adoption guard
- [x] Guarded bootstrap and idempotent migration deployment commands
- [x] Production-like database preflight
- [x] Protected staging release gate
- [x] Release, migration, staging, and rollback runbooks
- [x] First protected staging run recorded with smoke-test evidence ([run 31638573354](https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/31638573354), commit `62d9974edc57d11a88fbe874604be83edc582f66`)

### 5. Immutable audit history

Status: complete

- [x] Atomic database capture for governed operational, financial, inventory, lifecycle, configuration, and access tables
- [x] Central server module for actor-attributed semantic workflow events and secret redaction
- [x] Organization, farm, warehouse, actor, role, support-session, action, record, reason, before-value, after-value, and server-time evidence
- [x] Append-only database enforcement and revoked direct client mutations
- [x] Per-organization SHA-256 hash chain with CEO integrity verification
- [x] Assignment-aware and active break-glass-aware audit visibility
- [x] Human-readable Governance history without exposed database identifiers
- [x] Focused contract, redaction, coverage, and presentation tests
- [x] Apply `20260815002000_immutable_sensitive_audit_ledger.sql` to staging and complete role-based browser checks
- [x] Apply the verified migration to production and confirm the first tenant chain verification

### 6. Monitoring and recovery

Status: operational; managed backup retention pending

- [x] Structured server error capture in persistent Cloudflare Workers Logs without request secrets or raw records
- [x] System Administrator health dashboard with live database latency, scheduler state, and explicit evidence freshness
- [x] Append-only platform probe, provider-backup, and recovery-drill evidence with System Administrator-only visibility
- [x] Fifteen-minute staging and production application probes plus daily Supabase backup checks
- [x] Monthly production public-schema restore into an isolated local Supabase target with critical row-count and RLS checks
- [x] Dedicated incident, rollback, database recovery, severity, ownership, and evidence runbook
- [x] Apply `20260831000000_platform_monitoring_recovery.sql` to staging and production
- [x] Configure separate matching Cloudflare/GitHub monitoring intake tokens and the protected recovery connection
- [x] Configure a fine-grained Supabase `backups_read` token in GitHub
- [x] Deploy the release and retain the first successful application-probe and isolated-restore evidence
- [ ] Establish retained production backups: upgrade Supabase to a plan with managed backups, or approve a separately secured off-site logical-backup destination

## Second delivery wave

1. Action ownership, acknowledgement, due dates, escalation, and resolution evidence — implemented; migration applied to staging and production, staged role validation pending
2. Configurable in-app and external notifications — in-app delivery, preferences, audit evidence, and the email outbox are implemented, with the migration applied to staging and production; Cloudflare sender-domain activation remains disabled until a verified sender is configured.
3. Branded and scheduled management reports — implemented with immutable evidence snapshots, CEO-governed weekly/monthly schedules, scoped sharing, branded HTML/CSV downloads, and protected recurring generation; migration applied to staging and production, staged role validation pending
4. Mobile and unreliable-connectivity validation, followed by offline drafts where justified

## Deferred modules

CRM, Fleet, HR, and Training remain outside the production release gate until their business priority is confirmed. Placeholder routes must not be presented as completed modules.
