# Task 3: traceable egg sales

## Authoritative write path

One `daily_sales_records` row owns money, payments and customer identity. New egg
sales must provide `egg_sources: [{flock_id, egg_quantity}]`. Quantities are whole
eggs, not trays; their exact sum must equal sale quantity × the governed unit
conversion. Maximum 100 distinct flocks, all egg-producing and in the same
currently assigned farm. No source or conversion is inferred for an old sale.

Today retains its v1 command and receipt interface. Legacy creation uses the same
`record_egg_sale` transaction with a stable `request_id`. Old queued egg commands
without source evidence fail safely with an instruction to resubmit; they do not
invent allocation. Non-egg commands/operations are unchanged.

The transaction locks the request and farm, validates active account/assignment,
open seven-day operating window and exact converted quantities, freezes readable
source identity and conversion, checks running custody balances (including later
sales for backdated entries), appends `egg_sale_sources`, and audits the one sale.
Failure rolls back the sale, allocations and audit together. Retry IDs reject
changed payloads. Direct source edits are blocked independently of Today rollout.

## Reader mapping

| Reader | Treatment |
|---|---|
| Today/legacy entry | Explicit source fields; one sale operation |
| History/legacy sales list | One financial record; JSON containment matches sources before History pagination; in-page supporting allocations |
| Record Checks | Exact frozen eggs per flock; one duplicate-sale/financial identity; legacy conversion rules retained |
| Farm performance / legacy sales analytics | Source-level quantity and cent-balanced proportional money projection before location filtering |
| CEO dashboard / monthly reconciliation | Same projection for current/previous and selected flock/house/batch totals |
| Saved reports | New v3 evidence marker and original permission/publication locks; frozen v1/v2 contents unchanged |
| Bird-cycle closure | Still uses bird-category sales only; eggs cannot clear birds |

Money shares use cumulative cent rounding, then allocate payments within each
gross share, so combined totals remain exact and no individual balance is negative.
Projections never create another sale or payment. Conversion changes cannot
reinterpret the quantities of a source-versioned sale.

## Exact corrections

History, the legacy sale and unlinked-sale Record Checks open an exact
`egg_sale_sources` proposal. Farm Managers choose source flocks/counts, CEOs review
the current sale, money and proposed sources, and Managers apply once. Application
rechecks source timestamp, current authority, CEO validity and conversion evidence.
It appends a new allocation revision and retains prior revisions and financial
values. A stale source/approval rejects; legacy records are not bulk rewritten.
Existing History return links remain validated and preserved.

## Release

Migration: `20261102000000_traceable_egg_sales.sql`. Adds fields, append-only source
evidence, indexes, write guards and v3 report validation. Does not update existing
business records or old snapshots. Run Docker migration/RLS/integration and real
concurrency checks, then staging rollback/deploy checks with
`node scripts/release-recording-start-staging.mjs check --egg-sales` (or `deploy`).
The helper is pinned to the established staging project and verifies original
business fields remain identical. Production is excluded.
