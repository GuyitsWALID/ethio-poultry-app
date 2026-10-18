# Implementation checkpoint — reporting foundation

Date: 2026-10-18. This is an implementation checkpoint, not release acceptance.

## Changed
- Effective warehouse permission checks for operations stock, sales stock/expenses and finance evidence; farm permission checks on sales production denominators.
- Shared target validation rejects unavailable/contradictory scope rather than substituting data.
- Inclusive Addis timestamp bounds; stable paginated legacy sales/inventory reads with explicit failure above the 100,000-row safety bound, not partial totals.
- Historical flock inclusion and verified clearance-date coverage bounds; unverified legacy completion is marked unavailable. Approved movement-chain attribution remains open.
- Historical weight targets use measurement age; daily targets use recorded bird counts, not today's archived population.
- Feed consumption costs exclude warehouse transfers, subtract returns and remain unavailable if any consumption cost is missing. This corrects the former transfer/partial-cost overstatement without changing source records.
- Current creator role is rechecked before scheduled generation. CSV text is formula-protected; failed schedule forms remain open. These changes do not yet make snapshot persistence/audit atomic.

## Checks
- OpenSpec strict validation passed.
- 54 focused tests passed (report safety, pagination, evidence, management reports, operational analytics, report workspace, inventory workflow, farm/warehouse access).
- TypeScript passed, including the final incremental check after the lifecycle-boundary follow-up.
- Focused ESLint passed, including the final lifecycle/inventory check.
- Some inherited tests assert source contracts; these do not substitute for migrated-database authorization/concurrency tests.

## Not released / still open
No new migration or staging/production mutation, commit or push in this checkpoint. No new visual workspace yet. Atomic saved-report finalization/claims, recipient resource checks, legacy snapshot/RLS restrictions, movement-chain history, complete mixed-cohort formulas and the new read model remain open. Staging's Unavailable eggs fixture has not yet been inspected. Full builds/browser/staging acceptance are deferred until integration, not reported as passed.
