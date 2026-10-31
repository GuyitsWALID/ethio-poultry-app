# Tasks

## 1. Specifications and baseline safety
- [x] 1.1 Record approved scope and decisions in proposal/design/specification.
- [x] 1.2 Strictly validate OpenSpec and preserve independent work. Strict validation passed before implementation; working tree was clean.

## 2. Trustworthy recording starts
- [x] 2.1 Resolve verified actual-placement opening birds consistently, without current-count fallback. Actual placement, dated preceding-close and exact-day approved baseline reads are implemented; new Today starts revalidate the source under a flock lock. Undated old cached evidence requires refresh.
- [x] 2.2 Add governed bird/egg recording-start proposals, CEO review and atomic manager application. Explicit counts/reference/date are bound to source revisions; application and audit evidence are atomic and replay-safe.
- [x] 2.3 Integrate exact starting-point actions in Today and Record Checks.
  - Both reuse the bilingual inline proposal form. Record Checks offers today's physical baseline only for an eligible active assigned flock, preserving historical correction choices. Submission rechecks the exact finding/tenant/farm/flock; approval return links retain its finding context. Exact flock links resolve the authorized house even when a farm has multiple houses. Existing baselines, reliable preceding closes, completed flocks and resolved findings never receive a new-start action.
- [x] 2.4 Update baseline-aware reconciliation, coverage, reporting and lifecycle checks.
  - Dated opening-egg custody and approved population cutovers are respected. Pre-start loss corrections do not rededuct birds. Profiles label approved counts separately, preserving placement/age and missing coverage; report explanations distinguish balances from activity. A real governed closure accounts for the physical remaining birds without manufactured mortality or placement changes.
- [x] 2.5 Verify missing days, stale approvals, retries, tenant isolation and offline opening-source conflicts.
  - Full suite: 572 passed. Docker checks cover stale source/approval, replay, revoked access, cross-tenant isolation, source preservation and lifecycle closure. Real two-session races produce one baseline and one daily record. Signed-in Chromium acceptance passes manager proposal, CEO approval, replay, English/Amharic tablet layouts, missing report evidence, offline reload, preserved queue and safe stale-command conflict after reconnect/Refresh today. Physical-device, cross-browser and whole-release staging acceptance remain explicit release gates in section 6, not unfinished Task 2 implementation.

## 3. Traceable egg sales
- [ ] 3.1 Add explicit one/multi-flock source rows within one authorized farm.
- [ ] 3.2 Persist exact converted quantities, allocation and sale evidence atomically with concurrency protection.
- [ ] 3.3 Adapt History, reconciliation, reports and versioned snapshots without double-counting.
- [ ] 3.4 Preserve legacy sales and provide exact governed source corrections.

## 4. Scheduler
- [ ] 4.1 Add structured rules/occurrences, permission/revision checks and read-only legacy mapping preflight.
- [ ] 4.2 Add one-time/daily/weekly generation with 90-day window, stable occurrence identity and archive boundaries.
- [ ] 4.3 Build bilingual Scheduler under More with previews and role-specific editing.
- [ ] 4.4 Add authoritative Today completion commands/forms for weights, cleaning and medical work.
- [ ] 4.5 Integrate due/overdue Alerts, notifications and reasoned outcomes with atomic Finish day.
- [ ] 4.6 Extend offline grants/drafts/sync with backward-compatible command handling.

## 5. Expenses & purchases
- [ ] 5.1 Consolidate existing expense/receipt forms under More and reuse them in Today.
- [ ] 5.2 Add farm-level monthly templates and retry-safe explicit confirmations.
- [ ] 5.3 Preserve warehouse scope, source identity, evidence links and non-duplicated cost attribution.

## 6. Acceptance and release
- [ ] 6.1 Focused regressions per work package, then full tests/type/lint/production/Cloudflare builds.
- [ ] 6.2 Docker dry runs and migration/RLS/concurrency/offline integration.
- [ ] 6.3 Signed-in English/Amharic tablet acceptance using disposable authorized fixtures.
- [ ] 6.4 Staging migrations/application validation and separate notmain commits per work package.
- [ ] 6.5 Record remaining physical-device and Task 8 pilot gates without implying production approval.
