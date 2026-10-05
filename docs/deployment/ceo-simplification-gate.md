# CEO simplification: gated follow-up

Task 7.4 preserves the existing CEO destinations during the Farm Manager pilot. English/Amharic localization may change labels, but not destination order, routing, or access. The Today rollout control introduced in Task 7.3 enables managers only; it does not enable a CEO redesign.

## Current release boundary

`20261005001000_ceo_workspace_pilot_gate.sql` blocks setting `today_pilot_accepted_at` or enabling `simplified_ceo_workspace_enabled` through ordinary INSERT/UPDATE, including service-role operations. A timestamp alone is not pilot evidence. No acceptance API, browser override, or release function exists in this phase. Normal organization edits, false/null no-ops, and manager Today enable/rollback remain supported.

The migration stops for manual evidence review if existing acceptance or CEO activation values are found; it does not erase them or invent acceptance. Database owners can intentionally alter schema, so this guard is an application release boundary, not protection against a database administrator replacing it.

## Required evidence before Task 8.7

The release owner must record the isolated pilot organization, responsible manager, operating dates, evidence links and reviewer sign-off confirming:

- Backup and restore drill, daily backup monitoring, staging validation and rollback checks passed (8.3–8.5).
- One silent usability test and seven consecutive unassisted operating days passed (8.6).
- Every required daily job synchronized; no lost, duplicated or incorrect feed, stock, sales or health mutation occurred.
- The manager understands statuses and finishes the day unaided; repeated confusion is corrected.
- Every integrity discrepancy is resolved and affected records reconciled before acceptance.

Do not mark acceptance because automated tests, the rollout switch, or seven calendar dates exist.

## Separate reviewed change after acceptance

Task 8.7 must create a new OpenSpec change using the pilot findings. CEO primary destinations will be **Today’s status**, **Needs attention**, **Performance**, and **Approvals**. Existing advanced analytics, reports, access, Governance and audit routes remain available.

That change must introduce an evidenced, tenant-scoped acceptance and release operation, immutable audit history, authorization tests and rollback. Only then may a forward migration replace the current guard. Applying this migration alone never enables the future CEO workspace.

## Verification

- `tests/ceo-workspace-pilot-gate.test.mjs` locks the current CEO route list and the gate contract.
- `tests/database/ceo-workspace-pilot-gate.integration.sql` checks browser and service-role denial, fabricated timestamps, INSERT bypass, normal edits, tenant isolation, and manager rollout compatibility inside a rollback transaction.

Staging application and production deployment require separate approval. This task does not satisfy pilot acceptance.

### Local verification — 2026-10-05

- Full unit suite: 274 passed, no failures or skips. Focused gate/rollout/navigation suite: 15 passed.
- Migration contract: 74 files; OpenSpec strict validation and whitespace checks passed.
- Docker dry run applied all six locally pending forward migrations inside each test transaction. CEO pilot gate, Today rollout authorization, and feed warehouse compatibility suites passed and rolled back; local migration history remained unchanged.
- Dry-run tooling note: PowerShell regex replacement strings interpret PostgreSQL `$$` delimiters. Use a `MatchEvaluator` to insert migration text literally; the initial harness attempt failed safely and was rolled back before the corrected run passed.
- No application UI code changed; browser/build checks from Task 7.3 were not rerun.

### Staging database verification — 2026-10-05

- Verified explicit staging project `uzmhpecehmlwojdmitgj` and confirmed no existing CEO activation or pilot acceptance values before deployment.
- Applied `20261005001000_ceo_workspace_pilot_gate.sql`; deployment preflight passed.
- CEO pilot gate, Today rollout authorization, and feed warehouse compatibility suites passed against staging inside rolled-back transactions.
- Existing organization Today, CEO and pilot acceptance settings remained unchanged.
- Migration history contains all 74 expected versions, with no pending or unknown versions. Production was not targeted.
- Cloudflare build and live staging browser validation are not established by these database checks; Task 8.3 remains open.
