# Audit repair and remaining acceptance — 2026-11-10

## Released repairs

All 20 must-fix audit findings have shipped to production. This does not certify every business journey, device or pilot requirement.

| Findings | Repair | Master release | Production evidence |
| --- | --- | --- | --- |
| 1–7 | Operational security and current authority | [PR #5](https://github.com/GuyitsWALID/ethio-poultry-app/pull/5), `1871012` | 103 migrations; clean release gates, backup and smoke checks |
| 8–9 | Voided feeding sessions and stock-shortage bypass | [PR #6](https://github.com/GuyitsWALID/ethio-poultry-app/pull/6), `b95964d` | 105 migrations; zero historical candidates/deficits in recorded preflight; 609 tests |
| 10–11 | Safe structure setup, inherited assignment and manager Alerts | [PR #8](https://github.com/GuyitsWALID/ethio-poultry-app/pull/8), `15478cb` | 108 migrations; atomic setup and source-preservation checks |
| 12–14 | Retry-safe sales, entry windows and complete Today reads | [PR #7](https://github.com/GuyitsWALID/ethio-poultry-app/pull/7), `22383a6` | 107 migrations; 611 tests and database integrations |
| 15–16 | Feed targets and approved template weight work | [PR #9](https://github.com/GuyitsWALID/ethio-poultry-app/pull/9), `b850636` | 110 migrations; 619 tests; legacy evidence retained |
| 17–20 | Archived correction paging, email claims, schedule failures and Today request budgets | [PR #10](https://github.com/GuyitsWALID/ethio-poultry-app/pull/10), `2167b4c` | 113 migrations through `20261110007000`; 623 tests; five SQL integration suites; competing-worker email claims; production build and seven smoke checks |

Production releases used verified encrypted backups and preserved the 20 protected business-source fingerprints. PR comments hold the detailed release evidence. Background monitoring was resumed and verified active after PR #10. Staging rejection of master/release branches is the retained `notmain` guard, not production failure or staging acceptance.

## Genuine remaining work

- The separate [Today follow-up, PR #11](https://github.com/GuyitsWALID/ethio-poultry-app/pull/11), resolves the [2026-11-10 review](today-workspace-review-2026-11-10.md): online first-loss initialization without a snapshot, two stale regression contracts and misleading rejected-command status. Fresh Next.js/OpenNext builds and five executed signed-in Chromium scenarios passed, including an Amharic backdated save and full offline-day recovery/closure. Production rollout evidence is recorded on the PR; owner physical-device confirmation remains open.
- Staging was confirmed read-only at 102 migrations through `20261104000000` on 2026-11-10. The owner explicitly instructed that staging stay unchanged and the Today follow-up target production. Do not deploy the current application there or claim parity without separate approval.
- Parent 4.5's rebuilt signed-in bilingual Today recording acceptance is complete. Physical-device/cross-browser checks, offline upgrade/failure recovery, and integrated permission/feature-disable rollback remain separately gated. Reuse passing unchanged evidence; do not label browser discovery as browser execution.
- Resolve live email readiness: Cloudflare denied the sender-domain query. No real provider email acceptance was performed. Uncertain deliveries require provider reconciliation, not automatic resending.
- Review accounts created through the retired fallback-password path and arrange owner-controlled resets if affected. New input validation does not rotate old passwords.
- Review existing legacy weight checks explicitly in Scheduler. The repair deliberately did not guess their replacement dates or mark them complete.
- Maintain reliable daily backup coverage. Manual encrypted backups and the recorded restore drill passed, but that is not automatic daily backup certification.
- Keep Task 8's real-farm pilot requirements open. The owner and partner approved the product changes but cannot currently perform a real-farm silent day and seven unassisted days. Do not manufacture acceptance or real farm records.
- Broader CEO simplification remains deferred until its separately agreed acceptance gate is resolved.

## Reading older task notes

The parent [task list](../../openspec/changes/simplify-farm-operations/tasks.md) and linked change files retain dated history. A completed production repair is not missing implementation merely because an older pre-release note still describes its release as pending. Conversely, deployment alone never closes signed-in, device or pilot acceptance.

Documentation reconciliation itself authorizes no business write, credential reset, rollout flag or deployment. The Today follow-up has separate explicit owner approval for production only; it needs no new migration. Staging remains unchanged.
