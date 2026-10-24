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
