# Alerts audit remediation

Scope: the seven findings from the 2026-10-16 Alerts review. Work proceeds
in order. This is separate from the completed navigation/report tasks.

1. Acknowledge status/history consistency — implemented locally. The new
   service-only `acknowledge_operational_action` transaction locks the action,
   checks current account/source access and the expected owner/status/revision,
   and writes status, `acknowledged` history and semantic audit together.
   Notifications publish after commit using the existing delivery interface.
   The manager history label recognizes the canonical event name. Ten focused
   action/notification tests, TypeScript, changed-file lint and migration-lock
   verification pass. The migration and rollback
   regression passed in disposable Docker database
   `ethio_flock_lifecycle_dryrun_20261007`; both were rolled back afterwards.
2. Farm/flock/warehouse-scoped warnings — implemented locally. Missing Daily
   Records, mortality spikes and missed schedules now have per-flock keys and
   farm targets. Inventory warnings use per-store balances and warehouse targets;
   stock elsewhere cannot hide a shortage. Shared stores retain no farm target
   and require effective explicit store access. Warehouse verification reads the
   same store. Existing rule rows and legacy organization KPI warnings stay
   CEO-only, and the server rejects assigning unscoped warnings to managers.
   Six new behavioral regressions cover source routing, manager visibility,
   explicit shared-store access, tenant isolation, inactive/unknown stores,
   future/archived flocks and source-read failure. All 16 focused tests,
   TypeScript, changed-file lint and whitespace checks pass. No additional
   migration is needed for this scope change. Live staging validation is pending.
3. Atomic, stale-safe transitions shared by Alerts and Today — implemented
   locally. A database-owned action revision changes only when meaningful
   fields change, not on polling freshness. Alerts sends the displayed revision;
   Today commands require it. Assignment, claims, acknowledgement, starting,
   submission, CEO verification, deadline changes, reopening and escalation use
   one row-lock/version-check/status-history-audit transaction. Source refreshes
   also use the same conflict guard and skip stale automatic writes. Today keeps
   its receipt/dependency/operating-day checks and calls the shared transition
   inside the existing receipt transaction. The step-one acknowledgement RPC is
   retained as a compatibility adapter, not separate transition logic.
   Docker rollback regressions pass for competing claim snapshots, stale manager
   edits after reassignment, previous-owner denial, forced history failure,
   deadline/escalation races, Today replay and stale queued work, and blocking
   regression from CEO-review status back to started.
   All 48 focused action/Today/operation tests, TypeScript, changed-file lint, migration-lock and
   whitespace checks pass. Browser, production build and live staging checks
   are deferred until the ordered fixes are ready for release.
4. Exact, fail-closed source verification — implemented locally (2026-10-17).
   A service-only SQL checker reads the specific rule, warehouse/item, dated
   flock record, mortality window, latest schedule status, Governance request
   or Record Check. It never uses a limited warning list. Approved Governance
   requests remain active until applied or otherwise terminal. Missing,
   mismatched and unsupported sources are unavailable, not cleared. Record
   Checks still refresh through the existing engine before final verification.
   The locked transition repeats the exact check and chooses verified/failed
   itself; callers cannot assert that a source is clear. Automatic clear markers
   also repeat the check in their transaction. Completed schedules replace their
   older missed state in both discovery and verification.
   Superseded unscoped warnings require explicit CEO retirement with a reason.
   The distinct `legacy_retired` event and audit remain; no farm correction is
   claimed. The collapsed CEO control and explanation are English/Amharic.
   Fifty focused tests pass, including completed-versus-missed schedule behavior.
   The Docker source-verification regression passed for hidden list entries,
   approved-but-unapplied requests, exact stock/daily/schedule/Record Check
   evidence, unavailable/read-failed sources and retained retirement evidence.
   All three action Docker suites pass together against the pending migrations,
   with all fixtures and schema changes rolled back. TypeScript, changed-file
   lint, nine locale/catalogue checks, migration-lock verification and whitespace
   checks pass. Mortality-source and CEO-only retirement assertions also pass.
5. Authoritative warning calculations and Addis Ababa dates — implemented
   locally (2026-10-17). Replaced organization totals divided by today's bird
   count with flock-scoped, 30-day recorded bird-day rates and age-specific,
   bird-day-weighted breed targets. The database calculation follows Flock
   Profile's evidence and severity rules; discovery and locked verification
   call the same service-only function. Egg warnings apply only to layers and
   parent stock. Explicit zero eggs can warn; missing values/targets and voided
   records cannot prove a warning fixed. Partial coverage is labelled. Named
   performance warnings open the exact inline flock profile. Older KPI warnings
   are superseded and require reasoned CEO retirement, not false verification.
   Discovery and SQL checks use Addis Ababa dates; seven days means today plus
   six previous dates. Voided Daily Records do not complete missing-record work.
   Thirty-nine focused action, warning and flock-profile tests, TypeScript,
   changed-file lint, migration-lock and whitespace checks pass. All four Docker
   rollback suites pass against the pending migrations, including the new
   performance regression; no remote data or schema was changed.
6. Simple manager inbox, secondary settings and exact named actions — implemented
   locally. Managers default to unfinished My work, with Available work and Sent
   for review views. Available work requires the server's claim capability;
   another manager's work cannot appear as their own. Overdue/escalated work is
   first, then urgency and deadline. CEO assignment/verification controls remain.
   Advanced filters are collapsed, manager owner/status filters are removed,
   and notification settings are below the work list and load only when opened.
   Existing settings links still expand and scroll to the panel. Notification
   action links show the exact authorized active task despite saved filters;
   unavailable targets do not silently select another task. Named destination
   buttons preserve exact routes and parameters. Manager buttons and guidance
   use simpler English/Amharic wording, with at least 44px action targets and
   history content no longer forcing a 280px minimum width.
   Twenty-two focused inbox/action/localization tests, changed-file lint and
   whitespace checks and TypeScript pass; authenticated
   browser/tablet validation is deferred to the release pass. No new migration.
7. Lightweight bell reads and bounded synchronization/history — pending.

New forward migrations: `20261016000000_atomic_action_acknowledgement.sql`,
`20261016001000_atomic_action_transitions.sql` and
`20261016002000_exact_action_source_verification.sql` and
`20261017000000_authoritative_performance_warnings.sql`.
Regression: `tests/database/action-acknowledgement.integration.sql` checks
successful history/audit, forced history-write rollback, stale retry rejection,
revoked assignment and denial of direct browser execution.
The transition regression is `tests/database/action-transitions.integration.sql`.
Exact checks are in `tests/database/action-source-verification.integration.sql`.
Performance checks are in `tests/database/performance-warnings.integration.sql`.

Release update (2026-10-17): all four Alerts migrations (findings 1, 3, 4 and 5)
were applied individually to staging `uzmhpecehmlwojdmitgj`. Each passed internal
function permission checks and unchanged operational/action/audit fingerprints.
Production was not accessed. Findings 1–6 are separated into ordered commits on
`notmain`. The combined focused inbox/action/warning/localization suite passes
32 tests. Cloudflare deployment and authenticated browser validation remain
separate release checks; they are not claimed by the migration result.

Remaining boundaries: finding 7
must replace bounded/unpaginated source reads and expensive bell synchronization.
These are not certified fixed by the scope regressions.
Initial alert discovery still uses the existing unique-key insert/history path;
it is not claimed transactional by the transition fix. Notification publishing
remains after commit for Alerts; delivery/publishing recovery is not certified
by these tests. Today stale offline action drafts conflict safely; this change
does not add dependency chaining between multiple queued updates of one action.
Older KPI sources require explicit CEO retirement. New source changes after a committed verification can
reopen a warning; this does not freeze a farm's future work. Browser/staging and
full release verification remain deferred until the ordered fixes are ready.
