# Manager destination repair

Approved scope: complete shared repair, not Alerts-only. Applies only to Today-enabled Farm Managers. CEO, Admin and disabled-organization destinations remain unchanged.

## Destination rules

- Missing daily work with a known farm and a date inside the seven-day operating window opens the exact Today card.
- Ordinary past-record browsing opens the matching History category with its date/location filters.
- Mortality and warehouse warning summaries open scoped Farm performance Health/Stock views, retaining warehouse context.
- Flock performance concerns open the relevant analysis; missing historical evidence opens scoped Record Checks. Archived flocks never receive new Today work instructions.
- Feed templates and weight checks retain their compatible URLs but show focused configuration/check views, without the daily-entry dashboard. An unavailable exact batch cannot silently select another batch.
- Focused views reject noncanonical or contradictory `batch_id` aliases; the shared scope restores the canonical `filter_batchId` only. This prevents a remembered batch from replacing an explicit target.
- Exact correction, approval, finding, financial-period, task and configuration links remain intact. Unknown parameters, anchors, invalid dates, contradictory identifiers and unsupported scopes are not guessed or discarded.

`managerDestination` is a pure presentation module reused by Alerts, both notification-bell lists, Today assigned fixes and Flock next steps. It does not rewrite stored action routes, authorize access, or change domain records. Destination APIs continue enforcing permissions. Bird-check evidence links select the exact Daily Record in History.

## Compatibility and durable learnings

- Existing actions persist legacy `source_route` values; resolve them when displayed rather than rewriting historical action evidence.
- Recovered offline Today does not have a `FarmScopeProvider`. Its assigned-fix links use the pure resolver directly, not the provider-dependent client hook.
- Legacy routes remain available for authorized exceptions and rollback. This is not a blanket redirect or page deletion.
- New destination labels and focused-view explanations have English/Amharic catalog entries. Existing template-editor localization gaps remain part of Tasks 4.5–4.6.

## Verification

- Full unit suite: 532 passed, zero failures/skips.
- Includes destination/date/scope rules, exact-link preservation, feature/role isolation, archived flocks, focused Feed mode and caller wiring regressions.
- Scoped ESLint passed. `npm run build` passed, including TypeScript and generation of all 104 static pages. Local-only warnings: unset `APP_RELEASE` and old Browserslist data; neither blocks this build.
- No migration, dependency, business-data rewrite or deployment is included.
- Signed-in tablet/Amharic navigation and staging rollback checks remain release acceptance work; unit/source-wiring checks do not replace browser acceptance.

## Staging release evidence — 2026-10-24

- Application repair pushed as `98f4747`; GitHub Quality gate and Cloudflare staging deployment passed. Follow-up commits `e8bb845` and `2ed20aa` correct browser-test selectors only. No production or database action occurred.
- Read-only staging run: https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/40100573680 . CEO History passed. The manager reached both English landscape and Amharic portrait focused template views, with the selected authorized batch and no daily-feed/history dashboard sections.
- Acceptance remains open: the Amharic related History-link locator could not find its expected target. Investigate rendered accessible names/locale behavior before claiming bilingual navigation acceptance.
- Integrated Reports acceptance remains open: vaccination metric assertions expected 2 (CEO) and 1 (manager), while the UI showed 0. Investigate scope/period/rendering before attributing this to a calculation defect; do not manufacture records or weaken the populated assertions.
- Earlier test failures were corrected without application changes: duplicate shell/content headings, implicit select-label matching and Next.js's empty global route-announcer alert. Report error assertions now stay inside `main`.
- Feature-disabled live rollback and broader pilot checks remain unchecked. Unrelated Inventory work was excluded from these commits.

### Follow-up — 2026-10-25

- `ad7f85e` fixes the test period (canonical page-specific date filters) and read-only language setup (cookie/device storage plus a presentation-only profile-language override). Authorization and records are not mocked or changed.
- Run https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/40169101753 passed the prior vaccination checks and CEO/manager History, including the English/Amharic focused navigation checks. The two original failures are resolved.
- Integrated Reports now stops at currency presentation: expected `ETB826,219.80`, rendered `826,219.8 ETB`. The numeric value matches; keep the formatting regression open under Task 4.6, without weakening the assertion.
- Task 4.6 proceeds with the shared weight-entry sheet: bilingual copy, Ethiopian-calendar input, localized target numbers and 48px controls. No ledger or mutation-payload change.
