# Farm Performance — Unified Visual Analytics

## Why
Reports are fragmented across several pages. Before consolidating them, fix audited warehouse permission gaps, historical scope, timestamp boundaries, capped totals and saved-report safety.

## What Changes
- Keep `/app/reports`; present Overview, Production, Feeding, Health, Stock, Sales & Costs and Saved reports in one workspace called Farm performance.
- Reuse authoritative calculations and Recharts, with explanations, coverage and secondary exact History links.
- Add an authorized server read model and immutable all-topic snapshots with atomic audit, retry identities and scheduled claims.
- Preserve legacy URLs, exact correction targets, disabled organizations and Admin presentation.
- Translate controls and explanations; preserve Ethiopian-calendar display and Gregorian operating dates.

## Related Changes
Extends `simplify-farm-operations` and `unify-operational-history`. Combining Analytics/Reports for Today-enabled CEOs is a limited navigation exception, not the broader CEO redesign.

## Non-goals
No forecasting, diagnoses, new accounting rules, PDF service, business-record rewrite or physical route deletion. Production requires separate approval.
