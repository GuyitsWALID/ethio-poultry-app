# Operational localization verification — 2026-10-29

Scope: Tasks 4.5–4.6 operational interfaces, retained report/correction routes,
generated guidance, validation, frozen-report presentation and Ethiopian dates.
No business-data migration, ledger rewrite or production deployment is included.

## Local evidence

- `npm test`: 551 passed, zero failed or skipped.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run build`: passed; all 104 static-generation entries completed.
- `npm run cloudflare:build`: passed; OpenNext worker generated.
- `npm run migrations:verify`: passed, 97 unchanged migrations through
  `20261023001000_fix_organization_access_identity.sql`.
- `npm run test:browser:list`: 33 tests discovered in nine files.
- Final focused localization/calendar/AI regressions: 23 passed.
- `git diff --check`: clean before release.

Verification fixed missing Feed hooks, a remaining correction label, typed dynamic
catalog keys, unsupported tooltip formatting, an accidentally translated wire
status, localized-filter captions and outdated source-string assertions.
Existing authoritative calculation, access, audit and mutation tests remain in
the full suite. AI accusation rejection also covers Amharic output.

Local build notices: APP_RELEASE was unset (local unversioned build), Browserslist
data is old, and OpenNext warns about native Windows support. None prevented
successful builds. Staging CI must build the committed revision independently.

## Signed-in staging acceptance

Local CEO/manager credentials were not configured. The user explicitly chose
GitHub staging accounts for post-push acceptance. The staging reports-only gate
now includes `localization-staging.spec.ts`: both roles, both languages,
portrait/landscape tablet widths, report tabs, keyboard focus, touch targets,
Ethiopian date inputs, reload persistence and retained operational screens.
Only the account language preference is changed and restored; the test does not
record operations, grant access, alter rollout or generate paid AI analyses.

Release `e7933a6` passed GitHub Quality gate and Cloudflare staging deployment.
Signed-in run [40880000027](https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/40880000027)
passed populated Reports and History checks for both roles and CEO localization.
Manager tablet acceptance caught stock-count form overflow in Record Checks.
Diagnostic run 40881171696 confirmed 1503px content at a 1024px viewport;
its CEO Amharic Approvals heading check also failed and remains subject to rerun.
The follow-up uses tablet columns and shrinkable controls and translates the
remaining Approvals queue/step captions. Eighteen focused tests passed.

Final staging results are pending. Tasks 4.5–4.6 retain their final verification
checkboxes until that evidence is available. New terminology is not represented
as partner-reviewed; physical-device usability and Task 8 pilot evidence remain
separate acceptance requirements.

Follow-up `f393aa7` passed Quality gate and Cloudflare deployment. Signed-in
run [41047037582](https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/41047037582)
again passed Reports and History for both roles, plus CEO localization.
Manager localization exposed a profile-read race that could revert an explicit
language selection. Profile synchronization now runs once on mount and ignores
late responses after a local selection. Fifteen focused tests and changed-file
lint passed; the final signed-in rerun is still required.

## Final automated staging result — 2026-10-30

Release `64541f4` passed GitHub Quality gate and Cloudflare staging build.
[Signed-in acceptance 41049975777](https://github.com/GuyitsWALID/ethio-poultry-app/actions/runs/41049975777)
passed all six tests with no skips: two populated Reports comparisons, two
History checks, and two bilingual operational-screen/tablet tests.
Both roles passed English/Amharic switching, reload persistence, Ethiopian date
controls, reporting tabs, keyboard/touch assertions and the sampled retained
Approvals, Record Checks, Health and Sales screens. Test-account language
preferences were restored. No business records or access grants were changed.

Automated verification is complete for this localization release scope.
This is not the full Task 8 release gate or a physical-device/screen-reader
review. New terminology still needs partner acceptance; a dedicated bilingual
Today recording journey was not part of this read-only staging run.
