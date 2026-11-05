# Task 4: named-flock Scheduler

## Scope and interfaces

`scheduled_work_rules` owns plan versions and explicit named-flock targets.
`scheduled_work_occurrences` owns stable rule/flock/date identities and outcomes;
it links, rather than replaces, authoritative weight, biosecurity, health and
vaccination records. No notes-based status is generated or guessed.

GET `/api/scheduler` reads authorized rules/occurrences and eligible flocks.
POST saves/cancels a rule through a revision-checked, retry-safe SQL transaction.
CEO can manage all organization plans; managers only their own assigned-farm
manager-created plans. CEO-created plans remain CEO-controlled after a creator's
role changes. Both can preview once/daily/weekly dates. Weekly means the weekday of the
start date. End dates are inclusive; generation is bounded to 90 operating days.

Rule saves generate the next window. The existing authenticated monitoring job
refreshes the rolling window. GETs do not create occurrences. Completed history
is immutable; changes cancel only unfinished future instances. Today's promised
work and its overdue reminders remain even when future generation is stopped. Archived,
completed and not-yet-placed flock identities never gain executable work.

Today uses one additive v1 command, `complete_scheduled_work`, for complete,
defer and skip. It carries an occurrence revision, real completion fields, and
optional inventory usage. The existing dispatcher retains actor, assignment,
operating-window, receipt, dependency, lifecycle and audit checks. SQL repeats
occurrence scope/revision checks and executes stock-consuming operations once.
Deferral appends a separately dated occurrence and preserves the original reason.
Finish day checks unresolved due/overdue work under the same farm transaction lock
as rule changes and completion. Old commands remain readable and executable.

Cached task details preserve occurrence revisions. Existing grants still bind
user/tenant/farm/flock/date; reconnect reauthorizes and rejects stale plans while
retaining recoverable drafts. Interrupted offline preparation preserves already
cached forms; authorization and storage failures still block saving. Scheduler
itself is online-only.

## Presentation

Reuse existing forest #1d2a1f, sand #f8f6f2, divider #e6dcc7, leaf #4caf6b
and amber #f59e0b tokens, Fraunces headings and IBM Plex Sans body text.
A left-aligned dated agenda is the primary element; the editor uses large
ordinary checkboxes for named flocks and concise frequency choices. No decorative
charts, new font or dependency. Filters and editor stack on tablets; all controls
are at least 48px, visibly focused and bilingual. OperationDateInput retains
Ethiopian input/display in Amharic and Gregorian wire dates.

## Legacy and release

A read-only preflight inventories legacy weight tasks and encoded health plans,
flagging missing/ambiguous targets and status evidence. No automatic conversion
or source deletion. Exact legacy links remain available; unresolved mappings
must be operator-reviewed before conversion, never guessed.

Forward-only migration, Docker/RLS/atomicity/retry tests, staging rollback check
then migration, and notmain release. Task 5 and production are out of scope.
