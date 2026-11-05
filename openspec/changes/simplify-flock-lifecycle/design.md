# Design

## Module and interfaces

One server-only flock lifecycle module owns authorized profile/context reads and orchestration. Pure period calculations reuse dashboard helpers, with paired numerator/denominator evidence. PostgreSQL owns locks, source revisions, approval, allocation capacity, occupancy and idempotency. Browser progress or URL values are never trusted mutation evidence.

Retain `/api/flocks/workspace`, extend cycle membership; add `/api/flocks/[id]/profile?days=7|30|90` and `/api/flocks/cycles/context?farm_id=&cycle_id=`. Reads are private/no-store, authorized and bounded. Governance submission/decision/application remain the mutation interfaces, adding `batch_cycle_create` and `batch_cycle_close`.

## Profile

One selected profile expands below lineage. Default 30 days; operating periods end on the Addis operating date, completed periods on verified completion. Before placement dates are excluded. Unverified legacy completion cannot be inferred from the last record or an update timestamp. Current presence and before-clearance population are distinct. Bird age includes arrival age; weights use targets at measurement age. Missing evidence remains unavailable/partial, not zero. Totals and rates use supported source formulas; daily percentages/FCR are not averaged.

Performance and next steps share a card, but today's dated unfinished work is separate from historical evidence. Existing severity thresholds order all applicable concerns. Actions name their exact Today task or authorized correction. Archived flocks never receive today's entry instructions. History remains disabled. Legacy profile and batch URLs retain target context; missing/unauthorized targets cannot fall back to another flock.

## Cycle schema and migration

`batch_cycles` is farm-scoped and includes readable code, purpose, lifecycle state and verified completion. `batches.batch_cycle_id` groups canonical per-house batches. New placements create distinct flock/batch identities per house; no cross-farm groups or unrelated cohorts. Legacy singleton mappings require unambiguous ownership/lineage; never infer shared membership by name/date/supplier. Preserve old IDs, counts and evidence. Read-only preflight identifies occupancy overlaps, ambiguous lineage, inconsistent counts and unsafe pending approvals. Unresolved conflicts block affected activation.

Append-only closure, disposition, sale allocation and head-count attestation evidence links the exact request and source revisions. Allocations cannot exceed bird-unit sale quantities or CEO-approved physical head-count capacity for other units. Financial quantities/revenue are never invented or converted from kilograms to birds implicitly.

## Approved transitions

Cycle closure displays all members, final records/feed and current accounting. Actual completion date/time and final departures must account exactly for trusted remaining birds. Deaths/culls already recorded in Today are not deducted twice. CEO preview includes all targets and approved final Daily Record fields.

Application locks cycle, members and sources; rechecks tenant/access, approval/revisions, final-day records/feed, exact accounting and sale capacity; appends evidence, synchronizes only approved final removal/closing fields, sets remaining presence to zero once, archives all members, and writes per-record audit/applied result in one transaction. Source mismatch blocks without balancing. Reapplication is idempotent. Later evidence-invalidating edits require Governance and never automatically resurrect birds. Legacy archives need approved completion attestation before reuse, without rewriting historical population.

Creation requires farm, eligible houses, purpose/breed/arrival age, separate starting counts, source/costs and actual placement date. Never clone old live counts. Mandatory warning and checkbox confirm actual arrival/placement date. Future placement cannot activate birds. Backdating obeys operating/Governance windows. Same-day turnover requires old completion time before placement time (UTC storage, Addis display), across the whole shared cycle. All resources are created atomically; population sums match; concurrent occupancy is rejected. Quarantine counts as occupancy.

Retire branch-wide replacement; legacy callers receive guarded workflow or readable resubmission. Unsafe existing lifecycle approvals require refreshed multi-target evidence/reapproval. Whole-flock moves into empty houses use approved transfer history, preserving origin and validating current location through the movement chain.

## Compatibility and release

### Reviewed archived accounting amendments

Archived corrections may include exact death/cull event changes and a complete replacement final-departure list for the shared cycle. Every existing loss event on a reviewed date must be included; a reviewed zero explicitly removes an incorrect event while immutable per-record audit snapshots retain its original evidence. Event sums must equal the proposed Daily Record deaths/culls. No placement, completion-time, financial sale, payment, feed or stock mutation is authorized by this path.

Original closures, clearances, disposition rows and head-count attestations remain append-only. A new append-only accounting amendment supersedes current allocations only; effective-disposition/clearance views expose the latest approved evidence. All member final Daily Records must be reviewed when departures change. Final physical departures exactly match approved removal fields and every closing population remains zero. Shared-sale locks, current sale revisions and head-count capacity include allocations from other cycles. Subsequent closures and profile reads use effective evidence, not superseded allocations. Existing non-bird-unit head-count capacity cannot be silently changed. Manager proposes, CEO approves, assigned manager applies, and stale sources/revocations fail atomically.

Today recalculates both old/new same-day identities. Local drafts survive but completed/stale permissions cannot synchronize. Reconciliation and locked-record audit recognition accept only exact approved changes, never blanket future permission. Presentation follows Today rollout; lifecycle rules remain global and CEO navigation unchanged. English/Amharic display uses Ethiopian calendar in Amharic, Gregorian operational dates and Addis boundaries. User content is unchanged.

Docker dry run precedes staging migration and authenticated validation. Commit/push to `notmain` follows reviewed validation; production requires explicit approval.
