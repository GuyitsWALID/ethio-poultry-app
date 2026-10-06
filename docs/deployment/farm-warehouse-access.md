# Farm-owned and shared warehouse access

This forward-only change is tracked by `inherit-farm-warehouse-access` and supports `simplify-farm-operations`. Production is not authorized by this release.

## Rules

- One active, non-overlapping Farm Manager assignment per farm. A manager may operate several farms.
- All active warehouses with that farm's `farm_id` inherit access. No synthetic warehouse grants are created.
- Warehouses without `farm_id` require an explicit grant, including feeding. Access never overrides task-specific farm/branch or inventory-category restrictions.
- Immediate CEO handover transfers unfinished farm/owned-store tasks, preserves deadlines/evidence/escalation and resets acknowledgement. Submitted verification work and shared-only tasks/grants do not transfer.
- Revocation without replacement removes inherited access and flags unfinished work for CEO reassignment. Disabling Today does not restore old permission rules.

## Verification — 2026-10-06

- Task 7.6 work preserved separately in `4ada05e`.
- gstack review checklist applied to the access-change diff; compatibility gaps fixed in assignment responses and effective-access setup filters. The optional local review logger could not run because Bun is unavailable in the Windows shell; this document records the review evidence instead.
- 299 unit tests passed; TypeScript and full ESLint passed.
- All nine Docker database integration files passed with the pending migration chain in rollback-only transactions. The existing local foundation fixture UUID prefix was remapped in memory from `12000000` to `19000000` to avoid a pre-existing local fixture collision. No schema or fixtures were retained.
- SQL regressions cover inherited access without grants, new owned stores, inactive stores/managers, expired shared grants, wrong-organization scope, shared-store feeding denial, stock receipt/feed-close idempotency, one-manager exclusion, stale handover rollback, task/deadline/evidence preservation, recipient notifications, revocation and RLS.
- `test-farm-handover-browser.mjs`: English/Amharic at 768x1024 and 1024x768; readable preview, status/deadline, confirmation gate, stale rejection, no visible UUIDs, touch targets and no horizontal overflow. Mocked transport; not a live authorization test.
- `test-report-workspace-browser.mjs`: both tablet orientations passed Reports, Amharic, exact historical template links and disabled-Today legacy entry/navigation fallback. Mocked transport.
- Production and OpenNext/Cloudflare compilation passed with process-only CI placeholders. No production deployment ran. OpenNext warns that native Windows is not fully supported; live staging validation remains necessary.
- OpenSpec strict validation, migration lock verification (76 files), browser discovery and diff whitespace checks passed.

## Staging database

Target: `uzmhpecehmlwojdmitgj` only. Read-only ownership/overlap/scheduled-replacement/shared-feeding preflight returned no conflicts.

The operator explicitly chose to keep **DEMO Addis Central Farm Store** shared and grant the single active staging Farm Manager permission. The grant was applied transactionally with durable audit evidence labelled as an operator-approved staging change, not attributed to an application CEO session. Warehouse ownership and stock ledger count/quantity/value totals stayed unchanged.

Both migrations passed a rollback-only dry run against staging before deployment:

- `20261006000000_effective_farm_warehouse_access.sql`
- `20261006001000_atomic_farm_manager_handover.sql`

Locked deployment and database preflight passed. Post-deployment history has 76 versions, zero pending migrations and zero unknown versions.

All nine transactional database integration files also passed against staging. The two direct-psql rollout fixtures now initialize `request.jwt.claims` to valid empty JSON (hosted Supabase can otherwise leave an empty string); both passed again in local Docker. This is fixture setup, not relaxed application authorization.

Application commit `1a029f8` was pushed to `notmain`. GitHub Quality gate `37482390527` and Cloudflare staging build `86651c20-d6cc-4944-821e-149cbbe7c8be` passed; staging version `e318e2a9-0efb-455e-b3d4-2096d0b2661a` deployed at 100%.

Protected Reports comparison `37484876937` passed the CEO comparison but hit a connection reset before the manager comparison began. Playwright included a staging test-session cookie in that transport error. With explicit cleanup approval, the matching staging session and cascading refresh tokens were removed and that failed run's logs deleted. Issued JWTs may remain valid until expiry. No production credentials were involved. Authenticated read transport errors are now sanitized without printing their underlying request headers; the manager comparison must still pass on a new run.

The follow-up passed: protected run `37488388925` on test commit `14292b0` verified populated CEO and Farm Manager totals, stock/effective-access reader agreement, no-store headers, unknown-target rejection and manager handover denial. Task 7.5 is complete. GitHub Quality gate `37488356871` and the Cloudflare staging build also passed for `14292b0`.

## Remaining gates

- Complete broader authenticated staging revocation, offline queued-command and live feature-disable fallback checks under Task 8.3; the presentation tests above do not replace them.
- Review new Amharic permission/handover wording with the poultry partner. No new copy is represented as partner-approved.
- Real-farm pilot, backup/restore acceptance and production approval remain separate. Do not deploy an old application that directly grants farm-owned stores; reviewed rollback must retain the new authorization model.
