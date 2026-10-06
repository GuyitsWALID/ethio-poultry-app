# Legacy workspace compatibility — Task 7.6

Feed template management remains configuration, separate from Reports and routine Today entry. Existing template proposals, CEO approval, version history, import and validation operations are unchanged.

## Exact targets

Normal Feed landing selects active batches. An explicit template, session, history, advanced, Record Check, Governance, record or action target may retain its selected historical batch, but only if that batch is already present in authorized, scoped metadata. Unknown IDs never add a choice or grant access. Server Feed APIs still independently authorize every read and mutation.

Previously, Feed's active-only selector silently replaced a closed batch from an exact link with an unrelated active batch. `src/lib/feed-navigation.ts` now preserves that context. Existing routes are retained; no source ledger, stock calculation or mutation boundary changes.

## Feature-disable fallback

Today-enabled managers get Today-first navigation and routine Feed entry links into Today. Template management remains directly available on Feed. Correction links retain their exceptional editor; explicit Feed history keeps its evidence view.

After an authorized operator disables Today, managers refresh or sign in again. Original manager navigation, Feed session entry and Feed analytics return. CEO navigation is unchanged. Disabling Today does not remove historical records, undo migrations or discard local drafts. Use the audited control described in `today-rollout.md`.

## Local verification — 2026-10-06

- Four batch-selection regressions cover normal landing, historical exact targets, unknown/out-of-scope IDs and unsupported targets.
- Full unit suite: 296 passed, no failures or skips.
- TypeScript check passed.
- Focused ESLint, strict OpenSpec validation and `git diff --check` passed.
- `node scripts/test-report-workspace-browser.mjs` passed at 768x1024 and 1024x768. Uses actual React, scope, next-intl, Sidebar and Feed renderers with mocked transport/navigation. Verifies historical template values, automatic template opening, version/configuration access, correction editor, history expansion, original navigation and routine Feed entry when disabled, and unchanged CEO navigation. Existing bilingual Reports checks also pass.
- No business writes occur in this presentation runner. It does not certify database authorization, deployed flag changes or a production rollback.

Live staging feature-disable verification, supported-browser coverage and full release acceptance remain under Tasks 8.2–8.3. This change adds no migration and does not change staging or production assignments, feature flags or deployments.

This work was preserved in commit `4ada05e` and pushed to `notmain` with the warehouse-access upgrade on 2026-10-06. Production/Cloudflare compilation was repeated successfully for that release, and staging's Cloudflare build/deployment passed. Production was not deployed. Live feature-disable acceptance remains under Task 8.3; disabling Today must retain the new warehouse authorization model.
