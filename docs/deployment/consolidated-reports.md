# Consolidated Reports — Task 7.5

## Current implementation

`/app/reports` provides five read-only sections for CEOs and Today-enabled Farm Managers: Production, Feed and FCR, Health and deaths, Stock and usage, and Sales and finance. Daily entry remains in Today. CEO navigation order and the pilot acceptance gate are unchanged.

The presentation module at `src/lib/report-workspace.ts` exposes `loadReport(section, input, read)`. It validates dates, chooses the existing authorized reader, and maps source values without recalculating business totals. The browser supplies a private, no-store, abortable reader. Results are keyed by filters so a previous farm's figures are not displayed while a new request is loading or rejected.

| Section | Existing authoritative reader | Scope and interpretation |
| --- | --- | --- |
| Production | `/api/operations-analytics` | Existing tenant/assigned-farm filtering; egg totals, production rate, marketable rate, record coverage |
| Feed/FCR | `/api/feed/control` | Explicit batch selection; the full batch, not one flock; FCR is never averaged across batches |
| Health/Mortality | `/api/mortality/dashboard` and `/api/reports/evidence?section=health` | Official Daily Record deaths and existing cause allocation; clinical evidence excludes schedule metadata; vaccinations use actual completion dates, not scheduled dates; clamped source dates remain explicit |
| Stock/Consumption | `/api/inventory/workspace` | Independently authorized warehouse and Gregorian stock month; quantities remain per item/unit; current stock is not historical month-end stock; warehouse expenses stay in this section, including branch-store costs without a farm |
| Sales/Finance | `/api/sales/analytics` and `/api/reports/evidence?section=finance` | Existing sales/profit results plus recorded assigned-farm costs and overlapping financial-close evidence; expense totals are separate from estimated sales profit and close-period costs are never summed together |

Missing or non-finite values remain unavailable, not zero. Estimates are labelled. Dates use the existing Ethiopian-calendar display in Amharic; database dates and the explicitly labelled stock accounting month remain Gregorian. Names and evidence entered by users are not translated.

## Compatibility

- Disabled Farm Managers keep the existing Branch Reports workspace.
- System Admin keeps the advanced workspace.
- `view=advanced`, finding, Governance, financial-period, cost-entry, and saved-report targets retain the existing advanced workspace.
- The Record Check correction banner remains on the route.
- Today-enabled managers see a scoped Reports handoff in place of analytics on Production, Feed, Mortality, Stock, and Sales pages. Readable history and exceptional editors remain on those pages.
- CEO and disabled-manager analytics remain unchanged. Exact correction targets, `view=advanced`, and explicit `feed_target=feed_history` links keep their original evidence view. Feed template management stays outside the analytics handoff.
- No migration or feature-setting change is included. The staging release below is separate from the local implementation; production is unchanged.

## Verification boundaries

`tests/report-workspace.test.mjs` checks source-value preservation, nonzero organization/farm production examples against `summarizePeriod`, missing values, exact filters, batch scope, independent warehouse scope, mixed stock units, official deaths, estimated profit, rejected reads, and catalog parity.

`tests/browser/report-workspace.spec.ts` checks authenticated portrait/landscape layout and locale persistence with deterministic report-response fixtures. A separate case calls real local readers as CEO and assigned manager, compares the isolated one-farm fixture, and checks unauthorized farm/warehouse rejection. These checks do not replace populated staging cross-tenant and revocation tests.

## Evidence authorization and completeness

The server-only evidence adapter checks the verified role, organization, and current farm assignments before resolving labels or reading records. CEO branch-only cost scope includes branch costs without a farm; managers never inherit this broader permission. Houses and new batches can be authorized even before a flock has records. Requested targets are checked against trusted tenant/assignment metadata, not treated as access grants.

Stable pagination loads complete evidence up to a bounded 20,000-row limit. Exceeding that limit or failing a page returns an error, never a partial expense total. Invalid amounts remain unavailable. Clinical rows, completion evidence, expenses, and financial-close fields are projected into readable records without database identifiers. The endpoint is read-only and uses private/no-store headers on success and failure.

`tests/report-evidence.test.mjs` covers tenant and assignment restrictions, contradictory scope, empty houses/batches, voided records, schedule metadata, vaccination deduplication, nonzero CEO/manager expense scopes, branch-only costs, invalid amounts, overlapping periods, pagination, and adapter/rollback contracts. These injected-fixture tests do not certify live database authorization.

## Remaining release acceptance

- Populated CEO and assigned-manager source comparisons passed across all five sections in protected run `37488388925` (2026-10-06), including the populated stock prerequisite. See the acceptance evidence below.
- Run authenticated staging tenant-isolation, revoked-assignment, deep-link, and feature-disable rollback checks. Complete supported-browser and broader accessibility validation under Tasks 8.2–8.3.

The new report catalogue wording is implementation copy; broader translation and poultry-partner review remain part of Task 4.6. Task 7.5 is complete; broader release acceptance remains under Tasks 8.2–8.3.

## Local verification — 2026-10-05

- `npm test`: 292 passed, no failures or skips, including 18 focused report/evidence tests.
- `npm run typecheck`: passed.
- Production build: passed after the final code changes (`npm run build` with a process-only local validation value for `MONITORING_INGEST_TOKEN`). The configured local token was too short; no secret file was edited. Wrangler required permission to write its local build cache. No deploy command ran.
- Focused ESLint for all changed application modules, unit tests, browser specification, and browser runner: passed.
- `openspec validate simplify-farm-operations --strict`: passed.
- `npm run migrations:verify`: passed; the existing 74-file migration chain is unchanged.
- `git diff --check`: passed.
- `node scripts/test-report-workspace-browser.mjs`: passed at 768x1024 and 1024x768, using actual React, scope/filter, next-intl, date, and Reports modules with mocked transport/navigation. Covers five sections, nonzero evidence, touch-target height, no page overflow in English/Amharic, rejected reads without stale values, exact handoffs, correction links, and disabled-manager fallback.
- The earlier authenticated Next-development browser specification remains unverified as a full suite: portrait previously timed out during compilation and the real-reader comparison was not completed. The new presentation runner does not replace authenticated/live database validation.
- No persistent test server was started in this continuation. Staging and production were not changed; no migration was added or applied.
- Cloudflare preview, populated live-source comparisons, and authenticated staging end-to-end verification remain pending. Task 7.5 stays unchecked until that acceptance evidence exists.

## Staging release — 2026-10-05

- Application commit: `446dc621ad7cad284012c9e9956a9d6e17a1d1f6`; read-only staging test runner commit: `b4cbeda63fb34709a4049ec2d49fff853b46785b`.
- Staging-only OpenNext build and Wrangler dry run passed. Build settings explicitly selected `staging` and Supabase project `uzmhpecehmlwojdmitgj`. No secret file was changed.
- Deployed to `ethio-poultry-app-staging.walidmurad65.workers.dev`, Worker version `6c91180c-2d89-493f-910f-f070cefb330c`, preserving existing runtime variables and secrets. Previous staging version: `231ce6eb-bcbd-4ef7-a7cd-2e0b2f247a53`.
- Sign-in smoke: HTTP 200. Anonymous `/api/me/context` and `/api/reports/evidence`: HTTP 401 with private/no-store headers.
- `notmain` pushed; GitHub Quality gate run `37357008852` passed. TypeScript and focused lint also passed after adding the live staging specification.
- Dedicated staging CEO/manager credentials remain in GitHub's protected staging environment. The existing Staging release gate now supports an explicitly labelled `reports_only` mode; this does not certify or replace the full release gate.
- Populated Reports comparisons in run `37357052107` failed. CEO comparison timed out on an English-only language-control selector while the dedicated account used Amharic. Manager comparison reported no authorized warehouses. No business records, account credentials/roles, assignments, rollout flags, or database migrations were changed; tests use the normal language preference control.
- Test-only commit `fef126f` fixes the bilingual selector and removes retries so fixture failures do not repeat unnecessarily. It exercises the other report sections before requiring populated warehouse acceptance; it never grants access or weakens authorization. Pushed to `notmain`.
- Corrected run `37360039957` logs recovered on 2026-10-06. CEO comparisons passed all five sections. Manager comparisons and empty unauthorized-stock checks passed; the only failure was the final populated-stock prerequisite: `Dedicated staging manager needs an existing authorized warehouse for populated stock acceptance` (zero authorized warehouses). The dedicated staging manager's warehouse assignment needs an explicit operator choice before full stock acceptance. No access grant was added or authorization weakened. Task 7.5 remains unchecked until populated manager stock comparisons pass.
- Production application and database were not changed.

## Populated staging acceptance — 2026-10-06

- The operator explicitly approved keeping DEMO Addis Central Farm Store shared and granting the single active staging Farm Manager permission. Ownership was not guessed or changed. The separate `inherit-farm-warehouse-access` release records the grant, audit, migration and stock-invariance evidence in `farm-warehouse-access.md`.
- Protected workflow `37488388925`, test commit `14292b0`, passed both CEO and Farm Manager comparisons using GitHub staging credentials. All five report sections matched existing source readers; populated stock, effective warehouse access, private/no-store responses and unauthorized targets were checked. Farm Managers were denied the CEO handover endpoint.
- Application access upgrade `1a029f8` passed GitHub Quality and Cloudflare staging deployment. Test follow-up `14292b0` passed GitHub Quality and Cloudflare staging build. All 299 unit tests, TypeScript, full lint and nine staging transactional database integration files passed.
- The preceding run hit a connection reset and exposed a staging test-session cookie in the transport error. Approved cleanup removed that session/refresh tokens and deleted the failed logs. Subsequent authenticated read errors are sanitized. No production credentials were involved.
- Task 7.5 is now checked. This read-only Reports acceptance does not certify offline synchronization, live feature-disable rollback, revocation races, cross-browser coverage or the real-farm pilot.
