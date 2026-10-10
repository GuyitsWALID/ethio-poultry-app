# Simplified Flock Profiles and Safe Batch Cycles

## Why

Flock selection is unclear, profiles leave the workspace and prioritize today's missing inputs over flock performance. Existing branch replacement can archive unrelated placements without physical bird accounting. This change extends `simplify-farm-operations` with one flock workspace and explicit, approved lifecycle transitions.

## What Changes

- Obvious selection, readable lifecycle badges and one inline profile with 7/30/90-day evidence and named next steps. Today-enabled managers no longer see the duplicate registry. History is disabled until built.
- Farm-scoped shared cycles group existing house-specific canonical batches without rewriting their identifiers or ledger references.
- Manager proposes, CEO approves, manager applies verified cycle closure and actual-date placement. All lifecycle entry points share transactional guards, regardless of Today rollout.
- Closure allocates existing sales or evidenced final departures, never creates revenue or duplicates losses. Whole-flock transfers remain approved exceptions into empty houses.
- Private authorized read interfaces, English/Amharic controls, immutable evidence and forward-only migration preflight.

## Capabilities

### New Capabilities

- `flocks/inline-profile`: Evidence-based period profile and exact next steps.
- `lifecycle/safe-batch-cycles`: Shared cycles, approved closure/accounting and safe placements.

### Modified Capabilities

Existing Today applicability, Governance application and reconciliation must recognize approved lifecycle changes and same-day turnover without weakening source rules.

## Non-goals

No History page, broad sidebar redesign, automatic cohort mixing, guessed legacy mappings, invented cleaning interval or production deployment.

## Impact

Forward migrations, lifecycle module, Governance request types, read interfaces, flock/batch presentation, Today/reconciliation compatibility and regression/integration/browser tests. Release through Docker, staging and `notmain`; production requires separate approval.
