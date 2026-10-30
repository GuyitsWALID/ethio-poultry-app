# Delivery design

## Evidence and starting point
Prefer saved Daily Record, reliable preceding close, approved baseline, then
verified placement on its actual day. Never treat mutable current_count as a
historical opening count. Preserve missing-day coverage and original placement.
Baseline application binds approved physical birds and separately confirmed eggs
to a recording start date, source revisions, actor/tenant and audit evidence.
No fictional mortality, culls, sales or prior production is generated.

## Sales
One sale retains its money/payment identity. Child source allocations hold
egg-equivalent quantities per authorized flock within one farm. Exact conversion,
atomic allocation, retry protection and consistent reader adaptation prevent
duplicate stock/revenue attribution. Legacy sources remain unchanged until an
exact governed correction. Frozen reports keep version-specific interpretation.

## Scheduler
Rules and occurrences are structured records; notes are not a status database.
One-time, daily and weekly repetition uses Addis Ababa dates and a 90-day rolling
window. Generation is idempotent per rule/flock/date. Rule edits affect unfinished
future work only; no inheritance by replacement flocks. Plans and actual records
stay separate and are linked atomically on completion. Medical schedules do not
automatically administer treatment or deduct stock.

Today executes weighing, cleaning, vaccination and treatment. Outcomes are
completed, deferred with a new date/reason, or skipped with a reason. Due/overdue
work feeds Alerts and notifications; atomic day closure checks outcomes.
Offline commands retain drafts and fail safely on revised plans or revoked access.
Legacy schedule conversion requires unambiguous targets/statuses; conflicts block
affected conversion rather than being guessed.

## Expenses and purchases
More contains Scheduler and Expenses & purchases, preserving primary navigation.
Reuse cost_entries, recurring_cost_templates, receipts and existing operations.
Monthly confirmation remains explicit and unique per template/Gregorian billing
month. Add farm-scoped templates without inventing a warehouse. Stock receipts
and expenses remain distinct evidence, without duplicate financial attribution.

## Release
Forward-only migrations, read-only conflict preflights, Docker integration,
staging application acceptance and notmain. Keep authorized exact legacy links
and disabled-tenant presentation. Do not deploy to production.
