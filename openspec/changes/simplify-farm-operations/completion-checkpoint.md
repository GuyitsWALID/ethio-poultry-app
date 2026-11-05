# Simplification completion checkpoint — 2026-10-24

## What is implemented

- Parent Tasks 1–3: specification, database safeguards, authoritative Today orchestration.
- Task 5: offline draft/outbox/reload/restart and receipt chaining. Owner accepted local offline work and subsequently confirmed staging tested. Cross-browser/device certification is separate.
- Task 6: in-place daily work and atomic online Finish day.
- Task 7: enabled-manager navigation, rollout control, preserved legacy/configuration routes. History and Farm performance supersede the original secondary navigation design.
- Linked changes: inherited farm warehouse access/handover; inline flock profiles and guarded cycle closure/placement; unified History; unified Farm performance and saved reports.
- Reports call-budget repair `6b56d2a` is deployed; owner confirmed Feeding/Sales fixed. Quality gate and Cloudflare checks passed on successor `8d7a053` and visual checkpoint `a221ef2`.

## Changes in this checkpoint

- Today bird, health and embedded form rejection messages now use the complete existing error-code catalog rather than generic validation fallbacks. Assignment loss, locks and insufficient stock retain their specific translated explanations.
- Today assigned fixes reuse translated notification statuses instead of raw `in_progress` and similar codes. User-entered action text is unchanged.
- Shared approved feed-template review is bilingual, including headings, counts, known feed types and numbers. Real render regressions cover both locales, missing values, plural counts and escaped unknown source text. This does not complete the main Feed Control/configuration module.
- A TypeScript-AST regression checks all Today component files for visible hard-coded text, accessible labels, conditional literal text and missing static message references. Existing catalog parity and date tests remain in force. Dynamic source/user content requires separate behavioral checks; static scanning is not full visual certification.
- Removed the superseded offline implementation blocker from Task 8.2.
- Closed History's own staging release task against its recorded successful signed-in History gate. Reports acceptance remains separately tracked, not waived.
- Updated the Reports release checkpoint to reflect deployment and owner confirmation without pretending every integrated acceptance case passed.

## Remaining implementation: localization

Current checkpoint verification passed: 101 focused Today/localization/locale
regressions, scoped ESLint for every changed component/test, `npm run typecheck`
and `git diff --check`. The feed-template tests render the real component in
both locales; no signed-in browser, production build or broad full-suite rerun
is claimed for this checkpoint. No commit/push was performed.

Task 4.5 core code and static CI coverage are present; current rebuilt signed-in translation acceptance is still open.

Task 4.6 is not a final-checkbox-only task. Read-only AST inspection found these
remaining JSX text/accessible-label occurrences (not a count of unique phrases;
dynamic summaries and service-generated descriptions need separate review):

| Surface | Literal occurrences |
| --- | ---: |
| Feed Control/templates (`feeding-log/page.tsx`) | 112 |
| Health/treatment/vaccination (`health/page.tsx`) | 219 |
| Mortality control room | 64 |
| Sales (`sales/page.tsx`) | 141 |
| Approvals desk | 56 |
| Record Checks (`reconciliation/page.tsx`) | 68 |
| Shared approval banner | 6 |
| Audit history | 12 |

These counts establish remaining work; they do not authorize a generic runtime
English-to-Amharic replacement layer. Migrate controls and code-driven summaries
to explicit message keys, reuse formatting helpers, preserve user evidence and
test the relevant correction/configuration workflow. New partner terminology
must not be falsely included in the earlier glossary approval.

History and Farm performance already have bilingual namespaces. Their existence
does not certify legacy financial-close, approval or correction screens.

## Remaining acceptance and release

- Parent 8.1–8.3: consolidated current-release evidence, supported-browser/tablet/accessibility/Amharic checks, authenticated staging and feature-disable rollback. Reuse already-passing evidence where the tested code has not changed.
- Linked lifecycle 11–12: final rebuilt staging acceptance of the reviewed forms and recorded owner sign-off; safeguards/migrations are implemented, not missing anew.
- Linked warehouse access 8: broader authenticated rollback/revocation acceptance. Staging migrations and populated Reports/effective-access checks are already recorded as passed.
- Farm performance 5.3: integrated signed-in/tablet live-topic, saved-report and permission acceptance for the intended tenant. Keep populated assertions.
- Parent 8.4: encrypted production backup, verified restore, named rollback owner and daily monitoring before authoritative pilot data.
- Parent 8.5–8.6: separately approved isolated production pilot, silent usability observation and seven consecutive unassisted operating days.
- Parent 8.7: broader CEO redesign only after that pilot passes.

No production action, migration, feature-flag change or deployment is part of this
checkpoint. Existing uncommitted Inventory/catalog changes were preserved.
