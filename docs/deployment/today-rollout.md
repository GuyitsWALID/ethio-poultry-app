# Today rollout controls

Task 7.3 provides the rollout switch and evidence. It does not satisfy the backup, restore, staging release, or real-farm pilot gates in Tasks 8.3–8.6.

## CEO control

Open **Branch Network** (`/app/ceo/setup`) and find **Today workspace**.

1. Refresh the current status and the latest 20 rollout changes.
2. Enter a reason of 4–2000 characters.
3. Select **Enable Today** or **Disable Today**.
4. Confirm the saved state and new history entry.

Only an active CEO can use the endpoint. The organization comes from the signed-in profile, not a URL or form parameter. The database binds the actor to `auth.uid()`. The control supports English and Amharic, including the Ethiopian display calendar in Amharic. Names and reasons remain as entered.

A failed save keeps the reason and disables the action until status is refreshed. If a response was lost, refresh before retrying: the server may already have saved the change. Repeating the same desired state produces no extra semantic audit event.

## Credentialed system release

There is no browser-based System Administrator override, including during break-glass support. An authorized release operator may call `release_toggle_today_workspace` using protected `service_role` credentials with these explicit arguments:

```text
p_org_id: exact verified pilot organization UUID
p_enabled: true or false
p_reason: documented reason, 4–2000 characters
p_release_reference: immutable release/commit or incident reference, 7–200 characters
```

Verify the Supabase project against the staging/production runbook before calling the function. Do not paste credentials into SQL editors, logs, chat, or command history. Production activation still requires the pilot safety gates and separate release approval.

Both entry points lock the organization and persist the state and immutable hash-chained audit event in one transaction. Audit evidence includes the old/new state, timestamp, reason, actor (CEO) or release identity, and release reference. Farm Managers, browser administrators, and anonymous users cannot execute the private helper or release operation. Direct updates to the rollout flag cannot bypass the operation.

## Rollback

Use **Disable Today**, or the release-only operation with `p_enabled=false` and an incident/release reference. Managers refresh their page or sign in again to regain the original navigation and entry behavior. Existing records, command receipts, attestations, and audit evidence remain intact. This switch does not undo database migrations or delete unsent local work.

## Verification

- `npm test`: reason rules, sanitized history, route scoping and component wiring.
- `tests/database/today-rollout.integration.sql`: identity, tenant, role, reason and retry checks.
- `tests/database/today-rollout-boundary.integration.sql`: direct-write denial, private-helper denial, release credentials, immutable evidence, audit-chain validity and rollback.
- `tests/browser/today-rollout.spec.ts`: portrait/landscape control, reason gating, refreshed history, English/Amharic and failure recovery. Rollout API responses are mocked; real RPC authorization is covered separately by the transactional SQL tests. Dedicated CEO credentials are required; `E2E_REQUIRE_ROLE_CREDENTIALS=true` rejects missing credentials.

The new `20261005000000_today_rollout_authorization.sql` migration was applied to staging on 2026-10-05. Do not edit already-applied migrations. Live Cloudflare/Supabase end-to-end validation remains required under Task 8.3.

### Local verification — 2026-10-05

- Full unit suite: 271 passed; focused rollout suite: 4 passed.
- TypeScript, focused ESLint, migration lock verification and whitespace checks passed.
- Docker rollback dry run: original rollout, new rollout boundary, and feed warehouse compatibility SQL suites passed. No schema or fixture changes from these suites were retained.
- Chromium: portrait 768×1024, landscape 1024×768, and load/save failure recovery passed. The initial portrait run hit cold Next.js compilation during login; rerunning that check with a 60-second login allowance passed. These browser tests mock rollout responses and do not claim live staging end-to-end validation.
- Local browser fixtures used only Docker Supabase; staging and production were not changed. Temporary localhost:3100 test servers were stopped after testing.

### Staging database verification — 2026-10-05

- Verified the explicit staging project `uzmhpecehmlwojdmitgj` before deployment; production was not targeted.
- Applied `20261005000000_today_rollout_authorization.sql`; database deployment preflight passed.
- Original rollout, rollout boundary, and feed warehouse compatibility SQL suites passed against staging inside rolled-back transactions.
- Existing organization rollout states were unchanged after deployment and regression checks.
- Migration history contains all 73 expected versions, with no pending or unknown versions.
- Live staging browser validation and the Cloudflare deployment check remain outstanding; these database checks do not satisfy the full Task 8.3 gate.
