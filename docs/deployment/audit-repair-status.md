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

## Latest owner acceptance — 2026-11-12 reconciliation

The Today badge follow-up shipped to master as `3d4a6d6`. The owner confirmed it after the push, closing the reported badge issue and supplied English/Amharic narrow-screen review. This is owner-reported acceptance, not independent cross-browser or real-farm pilot certification.

The 2026-11-12 focused local regression run passed 60 tests across offline storage/worker/sync/runtime/recovery, rollout, navigation and effective warehouse access. These are unit/contract checks, not signed-in browser execution or a deployed rollback drill.

One additional signed-in Chromium scenario passed on a disposable local database clone: draft reload, real IndexedDB quota failure, midnight grant expiry, reconnect and CEO revocation of farm access. Both the verified-opening command and dependent Daily Record command remained intact after revocation; the server returned 403. Its stale one-command assertion was updated to verify both commands and their dependency, without changing application code. The runner reused the previously verified local bundle, not a fresh build; production and staging were untouched.

Command: `LOCAL_BROWSER_DB_TEMPLATE=ethio_jobs_20261110_e0d55b2d node scripts/test-flock-lifecycle-browser.mjs --today-count-only --reuse-local-build --grep 'Today draft recovery, quota failure, midnight lock and revoked access'` (set the environment variable using the host shell). This closes that local scenario only. Subsequent upgrade/browser and local feature-disable evidence is recorded below; neither this Chromium run nor the default Chromium-only configuration certifies every cross-browser journey.

## Technical acceptance follow-up — 2026-11-12

- `tests/browser/offline-upgrade.spec.ts` executes the real storage module and service worker on an isolated, data-free local HTTP origin. Cases cover managed connection closure, blocked/aborted schema upgrades, rejection of an older reader after upgrade, reload preservation, failed worker replacement retaining the prior shell, network-outage navigation and successful subsequent replacement. A synthetic next schema version exercises the existing migration algorithm; this is not certification of an as-yet-unwritten future business migration. Original draft contents and command identities/payloads must survive every recovery.
- Chromium and Firefox passed all four cases; WebKit and installed Edge passed all four after using a real local-server disconnection rather than inconsistent worker offline emulation. No engine is skipped. The existing `playwright.offline.config.ts` supplies the browser matrix; the default staging suite remains unchanged.
- A signed-in Chromium CEO disable/re-enable scenario passed using the disposable local runner and previously verified local bundle. Disabling restored Manager Dashboard/Daily Records navigation, removed Today navigation, returned the existing `FEATURE_DISABLED` HTTP 404 from both Today reads and commands, retained both queued commands and the actual Eggs/water draft, and re-enabling restored Today navigation. The test excludes recovery heartbeat metadata from user-draft comparison. No live flag was changed.
- Read-only monitoring inspection: [run 43146602205](https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/43146602205) succeeded but explicitly reported production external email disabled. That is not provider delivery acceptance. The owner subsequently chose in-app notifications only, closing email enablement as a current blocker. Daily managed backup readiness remains unverified; green application-probe jobs are not backup evidence. Managed-versus-external backup setup still requires the owner's decision before configuration changes.

Remaining acceptance is narrower, not waived: full signed-in tablet/Amharic/complete-offline-day journeys across the supported browser matrix; live deployment rollback/compatibility evidence under the owner's release policy; physical-device coverage beyond the owner's accepted screenshots; and the separate real-farm pilot. No production/staging writes, migration or deployment occurred in this follow-up.

## Genuine remaining work

### Final local checks — 2026-11-18

- Full unit/contract suite: 631 passed, zero failures or skips (`npm test`'s Node command).
- `npm run lint` and `npm run typecheck`: passed. Initial lint included generated, minified Playwright trace resources under `artifacts`; the existing lint ignore list now excludes only `artifacts/**/.playwright-artifacts-*/**`. Source/test rules are unchanged and all generated evidence is preserved.
- Final current-file browser run: all 16 upgrade/recovery cases passed across Chromium, Firefox, WebKit and installed Edge, one worker, no retries/skips (1.7 minutes). Command: `node node_modules/@playwright/test/cli.js test tests/browser/offline-upgrade.spec.ts --config playwright.offline.config.ts --workers=1 --max-failures=1 --output test-results/upgrade-final-20261118`.
- `openspec validate simplify-farm-operations --strict` and `git diff --check`: passed.
- No fresh application build, database integration rerun or new signed-in full-day matrix is claimed for this test/documentation/configuration-only checkpoint. The separately recorded signed-in rollback and revocation scenarios were not rerun. No commit, push, deployment, migration or live flag change was performed.

- The separate [Today follow-up, PR #11](https://github.com/GuyitsWALID/ethio-poultry-app/pull/11), resolves the [2026-11-10 review](today-workspace-review-2026-11-10.md): online first-loss initialization without a snapshot, two stale regression contracts and misleading rejected-command status. Fresh Next.js/OpenNext builds and five executed signed-in Chromium scenarios passed, including an Amharic backdated save and full offline-day recovery/closure. Production rollout evidence is recorded on the PR. The subsequent badge fix and owner's layout acceptance are closed above; remaining browser/failure/rollback coverage is separate.
- Staging was confirmed read-only at 102 migrations through `20261104000000` on 2026-11-10. The owner explicitly instructed that staging stay unchanged and the Today follow-up target production. Do not deploy the current application there or claim parity without separate approval.
- Parent 4.5's rebuilt signed-in bilingual Today recording acceptance is complete. Upgrade/failure recovery cases passed across four engines and local permission/feature-disable rollback passed as detailed above. Remaining gates are full signed-in cross-browser/device journeys and deployed rollback acceptance, not reimplementation of these verified safeguards. Reuse passing unchanged evidence; do not label browser discovery as browser execution.
- Email policy closed by owner decision on 2026-11-12: keep in-app notifications only and leave external email disabled. Provider sender verification/delivery acceptance is deferred unless email is requested later; do not describe disabled email as tested delivery. Any existing uncertain deliveries still require provider reconciliation, not automatic resending.
- Review accounts created through the retired fallback-password path and arrange owner-controlled resets if affected. New input validation does not rotate old passwords.
- Review existing legacy weight checks explicitly in Scheduler. The repair deliberately did not guess their replacement dates or mark them complete.
- Maintain reliable daily backup coverage. Manual encrypted backups and the recorded restore drill passed, but that is not automatic daily backup certification.
- Keep Task 8's real-farm pilot requirements open. The owner and partner approved the product changes but cannot currently perform a real-farm silent day and seven unassisted days. Do not manufacture acceptance or real farm records.
- Broader CEO simplification remains deferred until its separately agreed acceptance gate is resolved.

## Reading older task notes

The parent [task list](../../openspec/changes/simplify-farm-operations/tasks.md) and linked change files retain dated history. A completed production repair is not missing implementation merely because an older pre-release note still describes its release as pending. Conversely, deployment alone never closes signed-in, device or pilot acceptance.

Documentation reconciliation itself authorizes no business write, credential reset, rollout flag or deployment. The Today follow-up has separate explicit owner approval for production only; it needs no new migration. Staging remains unchanged.
