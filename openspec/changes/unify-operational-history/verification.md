# Verification — 2026-10-18

## Follow-up: inline details at all widths (local, not yet released)

User feedback supersedes the initial desktop split view. Details now expand directly beneath the selected record on every screen size, with one open record and click-again collapse. Existing styling and authorization/correction behaviour are retained. Focused Chromium checks passed at 1440x1000, 768x1024 and 1024x768, including selection far down a long list without jumping to the top, switching rows, collapse, Amharic display and correction returns. No migration or ledger change is required. The staging evidence below refers to the earlier released layout, not this unpushed follow-up.

## Passed

- Full unit suite: 430 passed, zero failures/skips. Focused History/navigation contracts: 26 passed.
- Local Chromium presentation: 1440x1000, 768x1024 and 1024x768; single in-place detail, no horizontal overflow, failed-pagination recovery, correction return, Amharic Ethiopian dates, offline state and revoked access clearing protected details.
- Sidebar role/rollout matrix: enabled/disabled Farm Manager, CEO and Admin.
- Focused ESLint and TypeScript; strict OpenSpec validation.
- Docker transactional dry run: new stock-date view, service-only grants, invoker security, unchanged ledger projection, Addis midnight boundary and all 14 History source projections. Rolled back.
- Pinned staging transactional dry run passed; migration `20261018000000_history_stock_operating_dates` then applied to staging only. Projection permissions, ledger preservation and all source/date columns verified. No production connection used.
- Production Next.js build and OpenNext Cloudflare Worker bundling passed for implementation commit `ec87454`, pushed to `notmain`. The small follow-up adds readable item names/units to linked daily supplies and reruns unit/type/lint checks; it does not change the migration or Worker configuration.

## Still required before release acceptance

- Signed-in staging History passed for both CEO and Farm Manager in run [39119039378](https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/39119039378), after the runtime implementation's successful Cloudflare deployment. It checked all eight category APIs, private/no-store responses, populated in-page Daily Record details and reload persistence. No test records or corrections were submitted.
- GitHub CLI authentication was refreshed successfully by the release owner. No staging account passwords were copied into chat.
- Follow-up `ca6b51d` passed GitHub Quality gate and Cloudflare staging deployment. Staging run `39118804292` failed the pre-existing Reports populated-egg assertion for both roles because its source metric was null; History was skipped by the failed preceding step. The History step now runs independently without hiding or weakening that Reports failure. No fixture data was created or changed to pass.
- Run `39119039378` remains failed overall solely because that unchanged Reports step failed again. Its History step passed. Diagnose Reports scope/data coverage before full regression acceptance; do not present a null metric as zero or silently add fixture data.
- Physical-device usability sign-off and partner review of newly added terminology are not established by emulated Chromium checks.

No stock quantities, source record values, reporting formulas or pilot-acceptance settings were changed. The Cloudflare skill was used to verify the existing local Worker build path; no deployment configuration was changed.
