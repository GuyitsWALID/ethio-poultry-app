# Verification — 2026-10-18

## Passed

- Full unit suite: 430 passed, zero failures/skips. Focused History/navigation contracts: 26 passed.
- Local Chromium presentation: 1440x1000, 768x1024 and 1024x768; single in-place detail, no horizontal overflow, failed-pagination recovery, correction return, Amharic Ethiopian dates, offline state and revoked access clearing protected details.
- Sidebar role/rollout matrix: enabled/disabled Farm Manager, CEO and Admin.
- Focused ESLint and TypeScript; strict OpenSpec validation.
- Docker transactional dry run: new stock-date view, service-only grants, invoker security, unchanged ledger projection, Addis midnight boundary and all 14 History source projections. Rolled back.
- Pinned staging transactional dry run passed; migration `20261018000000_history_stock_operating_dates` then applied to staging only. Projection permissions, ledger preservation and all source/date columns verified. No production connection used.
- Production Next.js build and OpenNext Cloudflare Worker bundling passed for implementation commit `ec87454`, pushed to `notmain`. The small follow-up adds readable item names/units to linked daily supplies and reruns unit/type/lint checks; it does not change the migration or Worker configuration.

## Still required before release acceptance

- Verify the resulting staging application deployment.
- Authenticated staging History checks for CEO and Farm Manager. Read-only regression is included in the staging gate alongside existing Reports comparisons; it must not create sample records or silently enable rollout to pass.
- GitHub CLI authentication was refreshed successfully by the release owner. The initial implementation's Cloudflare staging build and GitHub verify job both passed. Signed-in staging checks must run after the supply-label follow-up deployment; no staging account passwords are copied into chat.
- Physical-device usability sign-off and partner review of newly added terminology are not established by emulated Chromium checks.

No stock quantities, source record values, reporting formulas or pilot-acceptance settings were changed. The Cloudflare skill was used to verify the existing local Worker build path; no deployment configuration was changed.
