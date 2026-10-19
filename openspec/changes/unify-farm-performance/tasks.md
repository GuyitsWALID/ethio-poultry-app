## 1. Reporting safeguards
- [ ] 1.1 Enforce effective warehouse access in operations, sales/cost and evidence readers; reject contradictory targets; add permission regressions.
  - [x] Apply effective store checks to operations stock, sales stock/cost entries and finance expense evidence; enforce manager farm scope on sales production denominators.
  - [x] Reject unavailable/contradictory operations and sales targets using the shared evidence scope validator.
  - [ ] Verify reconciled aggregate provenance, database permission coverage and authenticated regressions before sign-off.
- [ ] 1.2 Include historical completed/archived/quarantined flocks using verified placement, movement and completion evidence; preserve loss accounting.
  - [x] Include historical flock identities, resolve verified clearance dates and bound expected days; expose unverified legacy completion instead of claiming full coverage.
  - [ ] Complete approved-movement scope handling and migrated-database coverage.
- [ ] 1.3 Correct inclusive Addis date boundaries and replace capped totals with complete stable pagination/aggregation.
  - [x] Correct sales and operations stock timestamp boundaries and inventory month boundaries to Addis operating days.
  - [x] Paginate sales calculation sources, inventory ledger/counts/catalogue/expenses and stably order operations reads; fail explicitly at the safety bound.
  - [ ] Complete the new range-aware read model and verify remaining domain adapters before sign-off.
- [ ] 1.4 Preserve weighted authoritative formulas, distinct culls/deaths, stock units, FCR types and unavailable evidence.
  - [x] Correct historical weight target age and historical daily target weights; exclude transfers/reverse returns in feed consumption costs and reject partial cost evidence.
  - [ ] Complete mixed-cohort FCR, separate culls, historical movement and all-topic coverage regressions.
- [ ] 1.5 Revalidate scheduled creators and recipients; make snapshot/audit finalization atomic and scheduled/manual retries safe.
  - [x] Recheck the schedule creator's active CEO role before execution.
  - [x] Add service-only leased retry claims, atomic snapshot/audit/receipt finalization, lost-response recovery and scheduled-period advancement.
  - [x] Revalidate creator/recipient farm authority and stale schedule settings at finalization; test audit rollback, retries, stale workers and revoked assignments in Docker.
  - [x] Capture server-side used-resource provenance and revalidate every recipient's warehouse access at atomic publication, listing and download; exercise direct authenticated RLS in Docker.
  - [ ] Add true multi-connection concurrency tests; finish schedule-definition audit transactions.
- [ ] 1.6 Protect CSV text, legacy snapshots and authorized saved-report pagination/exact selection; preserve failed forms.
  - [x] Share CSV formula protection across browser/saved exports; keep failed schedule forms open and make management reads private/no-store.
  - [x] Restrict unverifiable legacy snapshots to current tenant CEOs without rewriting them; filter authorized saved rows before the legacy list limit and protect direct database reads.
  - [ ] Add complete saved-report pagination and exact selection with browser coverage.
## 2. Shared read model
- [ ] 2.1 Implement authorized typed `/api/reports/performance` with metrics, series, coverage, units and explanation codes.
- [ ] 2.2 Implement range-aware inventory, scope-wide feeding, previous-period comparisons and evidence links without duplicate events.
- [ ] 2.3 Verify private/no-store, no offline caching and explicit denied/session/empty/missing/failure states.
## 3. Visual workspace
- [ ] 3.1 Add seven views, URL-persisted scope/date controls and accessible in-page supporting figures.
- [ ] 3.2 Add Overview and Production visuals with coverage and age-correct targets.
- [ ] 3.3 Add Feeding and Health visuals with supported explanations and separate FCR/loss types.
- [ ] 3.4 Add Stock and Sales & Costs visuals with correctly labelled units, balances, collections and margins.
## 4. Saved reports and compatibility
- [ ] 4.1 Add all-topic consistent v2 evidence snapshots and authorized in-page detail API/preview.
- [ ] 4.2 Integrate paginated saved reports/schedules, retry IDs and print-friendly HTML/CSV downloads.
- [ ] 4.3 Consolidate enabled navigation and legacy links; preserve exact corrections/financial targets and disabled/Admin behavior.
- [ ] 4.4 Complete EN/AM, Ethiopian dates, keyboard/table alternatives, focus and 48px controls.
## 5. Verification and release
- [ ] 5.1 Add behavioral permission, lifecycle, boundary, scale, formula, concurrency, retry and compatibility regressions.
- [ ] 5.2 Investigate staging Unavailable eggs against authoritative populated evidence; do not weaken assertions.
- [ ] 5.3 Run integrated full tests, TS/lint, production/Cloudflare builds and authenticated tablet/staging checks.
- [ ] 5.4 Docker dry-run necessary migrations, migrate staging, validate and push to notmain; no production changes.
