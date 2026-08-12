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

Status: in progress

- [x] Locked dependency installation through `npm ci`
- [x] Full lint command with zero warnings
- [x] TypeScript verification command
- [x] Calculation test command
- [x] GitHub Actions quality gate
- [x] Executive calculation regression tests
- [ ] Route authorization integration tests
- [ ] Feed close/reopen database integration tests
- [ ] Daily Record synchronization database integration tests
- [ ] Browser tests for every supported role
- [ ] Production build independent of remote font downloads

Run the local gate with:

```bash
npm run check
```

### 2. Permissions and separation of duties

Status: pending audit

- CEO: company-wide oversight, configuration, approval, and reconciliation
- Farm manager: assigned-farm operational entry and correction
- Veterinarian: health and authorized weight evidence
- Store keeper: stock custody and approved inventory movements
- System administrators: identity, organization, and recovery administration

The permission matrix must be enforced in route handlers and database policies. UI visibility is not an authorization control.

### 3. Operational reconciliation

Status: pending

Required controls:

- Flock opening-to-closing bird ledger
- Feed sessions, closed feed days, daily synchronized totals, and stock issues
- Daily mortality totals and cause-event allocation
- Egg output, classified eggs, and egg sales
- Ledger stock versus physical counts
- Cost allocation and profit-period lock status
- Active batch, flock, farm, and house lineage

### 4. Deterministic deployment

Status: implemented; external staging evidence required

- [x] Environment and release-identity validation
- [x] Self-hosted Fraunces and IBM Plex Sans application fonts
- [x] Cryptographically locked migration-chain verification
- [x] Verified data-free production baseline for empty environments
- [x] Canonical 14-digit migration history and metadata-only adoption guard
- [x] Guarded bootstrap and idempotent migration deployment commands
- [x] Production-like database preflight
- [x] Protected staging release gate
- [x] Release, migration, staging, and rollback runbooks
- [ ] First protected staging run recorded with smoke-test evidence

### 5. Immutable audit history

Status: pending

Sensitive mutations must capture actor, organization, action, record identity, previous values, new values, reason, and server timestamp.

### 6. Monitoring and recovery

Status: pending

- Application error monitoring
- API and database performance monitoring
- Backup status monitoring
- Scheduled restore drill
- Incident and recovery runbook

## Second delivery wave

1. Action ownership, acknowledgement, due dates, escalation, and resolution evidence
2. Configurable in-app and external notifications
3. Branded and scheduled management reports
4. Mobile and unreliable-connectivity validation, followed by offline drafts where justified

## Deferred modules

CRM, Fleet, HR, and Training remain outside the production release gate until their business priority is confirmed. Placeholder routes must not be presented as completed modules.
