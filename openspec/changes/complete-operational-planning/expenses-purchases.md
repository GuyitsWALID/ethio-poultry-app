# Task 5: expenses and purchases

## Existing sources, one transaction

`cost_entries`, `recurring_cost_templates` and stock receipts remain authoritative.
No purchasing/payables ledger, automatic charge, payment or reporting formula is
introduced. A receipt never also creates an expense. Existing inventory-category
cost exclusions in profitability are retained.

The existing cost POST and Today `record_expense` both call
`record_operational_expense`. It verifies current account, tenant, farm/warehouse
access, scope consistency, open operating date and exact money precision. It
locks request identity and template/billing month, then saves the optional
template, expense and explicit audit atomically. Exact retry returns the same
entry; changed evidence conflicts. Existing confirmed months are not silently
reopened after a void or correction.

Farm-level templates have no invented warehouse. Existing warehouse templates
retain their IDs and permissions. Billing months remain Gregorian, independent
of Ethiopian display dates. Templates never post future costs automatically.
No existing template or cost is backfilled or rewritten.

The retained receipt operation keeps its existing effective-access, stock and
new-item guards. A wrapper serializes retries, checks original receipt evidence
and audits the new receipt in the same transaction. History and cost calculations
retain one source identity. Past records and corrections still use History and
the existing governed workflows.

## Presentation and interfaces

GET `/api/expenses/workspace` returns authorized farms, compatible effective
warehouses, inventory choices and templates; private/no-store, no business writes.
`/app/expenses-purchases` sits under More for Today-enabled managers and CEOs.
Managers enter records; CEOs inspect through History. Disabled organizations and
Admin navigation are unchanged. Exact legacy/correction destinations stay intact.

Two tabs, not another dashboard: Expenses and Stock purchases. Both reuse the
same forms as Today. Large ordinary controls, existing forest #1d2a1f, sand
#f8f6f2, divider #e6dcc7, leaf #4caf6b and amber #f59e0b; existing Fraunces headings
and IBM Plex Sans body. Left-aligned fields stack on tablets; no new typography,
decorative charts or animation. English/Amharic labels use existing Ethiopian
date controls, Gregorian wire dates and Addis operating boundaries.

More is online-only; Today continues using existing durable drafts, command IDs
and sync authorization. Prepared templates are carried in task details. No new
service-worker caching or automatic monthly synchronization is introduced.

## Verification and release

Forward-only migration `20261104000000_farm_expense_confirmations.sql`, Docker
integration and concurrent-confirmation checks; then unit/type/lint, production/
Cloudflare and signed-in bilingual browser checks. Pinned staging rollback/deploy
verification preserves original costs, templates and stock quantities before the
notmain release. Production and whole-release physical-device/pilot sign-off are
outside this work package.
