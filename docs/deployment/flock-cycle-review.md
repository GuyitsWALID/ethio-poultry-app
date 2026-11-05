# Batch-cycle review and scoped audit — 2026-10-15

What this change does: A manager proposes a cycle placement or closure, the CEO
approves the exact evidence, and the manager applies it once. Existing sale,
stock and loss ledgers remain separate.

What this section does: It reads house/cycle readiness and prepares approved
lifecycle changes. Assumed load: one active manager per farm, several houses,
multiple farms in an organization and accumulated sale history. This is a scoped
audit, not a whole-product security certification.

## Should fix — implemented

1. **Closure offered sales that cannot belong to the selected flock**
   (`src/lib/flock-lifecycle/cycles.ts`, `src/components/flocks/cycle-workspace.tsx`).
   - What this is: Existing bird sales account for the flock's final departures.
   - Problem: Farm-wide choices included sales tied to another flock, batch or
     house, or dated before placement. Changing the flock retained the old sale
     and physical head-count reference. SQL would reject these, but only after
     wasted proposal/review work.
   - Fix: Return eligible flock IDs using the same farm, flock, batch, house,
     date and whole-bird checks as closure SQL. Filter each row's choices, clear
     dependent evidence when its target changes, and reject incompatible or
     stale sales when preparing the proposal. Kilogram sales still require
     explicit physical evidence; no birds are inferred from weight.
   - If skipped: Managers can prepare corrections that cannot apply, and
     supporting references can describe the wrong sale. No SQL bypass was found.

2. **An old placement confirmation survived changing the actual date/time**
   (`src/components/flocks/cycle-workspace.tsx`).
   - What this is: The checkbox confirms when the birds actually arrived.
   - Problem: Check it, change the date or time, and it remained checked for the
     changed proposal.
   - Fix: Bind confirmation to the exact farm/date/time tuple and clear it on
     context reset. Add a browser regression requiring reconfirmation.
   - If skipped: A manager can accidentally submit a date they never confirmed.

3. **Unrelated farms' bird-sale history could block cycle setup**
   (`src/lib/flock-lifecycle/cycles.ts`).
   - What this is: Context reads are bounded and fail rather than hide truncated
     evidence.
   - Problem: The sale query read the entire organization before filtering.
     At 1,000 bird-sale rows elsewhere, even placement context with no sale
     requirement failed with `SOURCE_LIMIT`.
   - Fix: Skip sales when no cycle members are selected. For closure, restrict
     the database query to authorized member farms and placement/completion dates
     before applying the existing cap. Keep fail-closed limits for actual evidence.
   - If skipped: Ordinary work on a small farm can stop because unrelated history
     elsewhere crossed the cap.

## Connected safeguards inspected

Reviewed context resolution, submission identity, the Governance submission and
decision/application boundaries, canonical placement/closure SQL, approved
movement checks, final counts, sale capacity, immutable evidence and existing
integration regressions. Existing database authorization, revision checks,
locks, atomic mutations and one-time application remain unchanged.

## Verification

Thirty focused sale-eligibility, cycle-contract and readiness tests passed.
Coverage includes farm-wide allocation, flock/batch/house mismatches, dates,
fractional bird counts, kilogram sales and dependent evidence resets. The added
confirmation browser assertion is not yet rerun against a rebuilt application.
TypeScript (`tsc --noEmit`), changed-file ESLint (`--max-warnings=0`) and diff
whitespace checks also passed.

Verdict: Concrete findings fixed locally; complete focused UI verification before release.

Not checked: Full-product audit, large-tenant load benchmarks, fresh production/
Cloudflare builds, rebuilt browser/staging acceptance of these fixes. Other
context reads retain their existing history caps. No new migration, remote
database mutation is required. Delivery targets `notmain` and staging application
validation; production is excluded.
