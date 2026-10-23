# Worker reporting read-budget fix — 2026-10-23

## Reproduction

Deployed staging version `9729da06-b008-4601-b8af-e4d02ca25b32` logged HTTP 200 with failed sections `feeding` and `salesCosts`. Returning a partial response had caught the source errors, so the page loaded while those topics did not.

The exact Laba Poultry Farms range, 2026-07-01 through 2026-10-20, used 68 database calls for the CEO and 81 for a Farm Manager with the pre-fix source. A 50-call limit reproduced the Feed/Sales failures. Local Node has no equivalent per-invocation fetch budget.

The former staging smoke chose the first profile of each role, which could belong to the internal tenant rather than Laba. The diagnostic now supports explicit organization/date selection and a read-call limit. Earlier claims that Laba lacked populated evidence are superseded; no test data was created or altered.

## Implementation

`ReportReadSession` shares named source promises only inside one report attempt. The scope, actor, role, support session and current/previous date window cannot be changed by a downstream reader. Shared Daily Record, weight and health queries retain assignment/historical-flock scope before source pagination. Warehouse checks and other domain-specific filtering remain in the canonical readers.

This is not a replacement ledger or shared cache. Every fresh report refreshes assignments and sources; no writes or browser/offline evidence storage were introduced. Failed source promises remain failed during the attempt. Legacy standalone routes use their existing query path. Frozen report capture and its atomic revision/audit/recipient checks remain unchanged.

## Evidence

Read-only actual staging source checks, pinned to Laba and the exact reported dates:

| Actor | Old calls | New calls | 45-call budget | Exact old/new evidence |
| --- | ---: | ---: | --- | --- |
| CEO | 68 | 22 | Pass | All sections, concerns and options equal |
| Farm Manager | 81 | 23 | Pass | All sections, concerns and options equal |

The five sections return partial / partial / partial / available / partial respectively (production, feeding, health, stock, sales/costs). Partial evidence remains partial, never substituted with zero or declared complete.

- Full working-tree regression suite: 511 passed, 0 failed (including the separate, uncommitted CEO setup regression).
- TypeScript and focused ESLint: passed.
- New real-reader regression enforces a 45-call budget and one read per shared source.
- New regressions cover actor/scope/window isolation, a fresh request after farm revocation, complete 1,201-row pagination, concurrent sharing, and failed-source propagation without retries/zero substitution.
- Existing schema regression follows the new central Daily Record selection and preserves the historical-location guard.

No migration required. Separate CEO setup/age-at-placement edits and migrations belong to other workspace work and are not part of this fix.

## Release status

Local implementation verified. User approved deployment through `notmain`; deployed staging verification follows the push. Production is outside this release.
