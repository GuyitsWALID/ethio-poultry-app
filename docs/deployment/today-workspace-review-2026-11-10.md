# Review of preserved Today edits — 2026-11-10

## Owner layout feedback — 2026-11-11

The owner supplied English/Amharic narrow-screen screenshots and accepted the tested experience apart from the wrapped, squeezed Not started badge. The follow-up keeps task statuses on one line, prevents their controls shrinking and lets the heading/summary use the remaining width, for normal and read-only cards. This records the owner's reported acceptance scope, not additional cross-browser, upgrade-failure or real-farm pilot certification. The badge-only change still needs its post-release visual confirmation.

What this change does: makes Bird count a read-only summary and starts the Daily Record automatically when saving other work. It also adjusts Health, offline queue preparation, translations and browser tests. These were uncommitted edits at review time, not part of production master `2167b4c`.

## Resolution and acceptance

The review below records the original unpublished state. All three findings were subsequently fixed in [PR #11](https://github.com/GuyitsWALID/ethio-poultry-app/pull/11):

- Online first saves use the currently authorized workspace in memory; only prepared, granted snapshots can support offline editing. Startup no longer bypasses durable queueing, and fields wait for storage initialization so typed input is not lost.
- Bird count's pending label excludes rejected/conflicting commands; Needs attention takes precedence. A real component render regression covers both languages.
- Regression contracts now distinguish read-only summaries from saving forms. Browser fixtures select feed types explicitly, isolate their flocks, wait for language preference persistence and identify queued commands by identity rather than UUID order.
- Full local unit checks, lint, TypeScript and fresh Next.js/OpenNext Cloudflare builds passed. The clean release CI checkpoint also passed.
- Five signed-in Chromium scenarios passed on disposable migrated local fixtures: bilingual portrait/landscape and Ethiopian dates; manager/CEO recording-start approval and stale-command conflicts; current first-loss save; an Amharic backdated first-loss save without an offline grant; and a full offline day through reload/restart, seven dependent commands, one-time inventory deduction, reconnect and one-time closure.

The owner approved production release only and requested staging remain unchanged. No new migration or real production acceptance records are needed. Actual physical-device confirmation is still pending the owner's check after rollout. Final release/build/smoke evidence is recorded on PR #11, not inferred from these local fixtures.

Scope: traced both live Today and recovered offline callers, the draft provider, offline runtime/store, receipt dependency SQL, loss-save SQL, workspace derivation, catalogs and changed tests. Assumed ordinary multi-house tablet use, including reload/reconnect, existing offline queues, and authorized backdated entry. No new production writes or deployments were performed.

## Must fix

### 1. First loss save fails without an offline snapshot

- **What this is:** `src/lib/today-workspace/offline-runtime.ts:119` adds the opening command before the first loss/record or feed-day close; the Health form no longer requires an already-started Daily Record.
- **Problem:** The opening command is created only from `store.getSnapshot`. `attachOfflineGrant` intentionally supplies no grant for backdated dates, and `acceptWorkspace` intentionally stores no such snapshot. A valid online backdated first-loss save therefore queues only the loss with `daily_record_id: null`; the authoritative loss SQL rejects that null. The no-runtime online fallback in `offline-context.tsx:116` also sends the command without this prerequisite. The read-only Bird count card no longer provides the old start action.
- **Fix:** Prepare the opening prerequisite from the currently authorized workspace for online saves, using cached evidence only for prepared offline saves. Keep the server opening/revision checks and receipt dependency chain; do not broaden historical offline grants. Add a regression for an online first-loss save without a stored snapshot, including the no-runtime path.
- **If we skip it:** Some otherwise permitted first-loss entries cannot be saved even though the page shows a reliable opening count.

### 2. Existing regression contracts still expect Bird count to be an editor

- **What this is:** `tests/offline-today-wiring.test.mjs:16` and `tests/today-localization.test.mjs:58` require the Bird card to call queued submit and translate its mutation results.
- **Problem:** This change deliberately removes that mutation path, but these two tests remain unchanged. A focused six-file run produced 55 tests: 53 passed, two failed at exactly these contracts.
- **Fix:** Apply mutation/queued-error assertions to actual saving forms. Add a read-only Bird card assertion instead; retain all Health/shared-submit error and offline coverage rather than deleting the guardrails.
- **If we skip it:** The unpublished change cannot pass the clean release gate, and the contract no longer describes the intended design.

## Should fix

### 3. Rejected losses are labelled “Waiting to sync”

- **What this is:** `src/components/today/bird-check-card.tsx:22` computes the count summary's pending state from every matching daily-record command, and line 42 renders it as waiting.
- **Problem:** Rejected/conflicting loss commands remain in the queue but will not automatically apply. The new predicate includes those terminal states; `openingConflict` handles only the separate `:birds` task and does not correct this Health-command summary.
- **Fix:** Distinguish queued/sending entries from conflict/rejected entries and show the existing Needs attention wording for the latter. Add a state/render regression for a rejected Health loss command.
- **If we skip it:** The count summary tells the manager to wait when the actual Health task needs intervention.

## Checks and verdict

- Read the complete changed application flow, caller changes, catalog changes and changed browser tests.
- Six focused test files: 55 tests, 53 passed, two stale Bird-card contracts failed.
- An in-memory runtime probe reproduced the no-snapshot case: one loss command, null Daily Record ID, no opening prerequisite or revision dependency. No network/database writes were made.
- `git diff --check` passed for the documentation and preserved edits.
- The deployed audit release separately passed 623 clean tests; that result does not certify these uncommitted edits.

Original verdict: fix 1 and 2 before shipping; include the small status correction in 3. All three are now resolved as described above.

Original review exclusions were later addressed by the implementation/build and signed-in browser checks above. Physical-device acceptance remains open. The original review itself changed no application code; the separately authorized follow-up does.
