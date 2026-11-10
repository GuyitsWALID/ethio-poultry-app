# Findings 10–11

- [x] Separate empty structure from governed placement and account creation; choose house types/capacities.
- [x] Use current farm assignment operation; transactional structure/audit/retry evidence; retire unsafe setup.
- [x] Remove Alerts from CEO-only middleware routes; preserve other restrictions.
- [x] Add English/Amharic setup controls and accessible native dialog.
- [x] Focused runtime checks and SQL dry run: 10 tests and four integration files pass.
- [x] Clean full CI, TypeScript, lint and production build. Release gate `42796072872` passed; later integrated master gate also passed.
- [x] Verified production backup, forward migration, master release and smoke checks. PR #8 merged as `15478cb`; migration `20261110002000` applied atomically with verified backup and all 20 protected source fingerprints unchanged. Production build and live smoke checks passed.

Evidence: [PR #8](https://github.com/GuyitsWALID/ethio-poultry-app/pull/8). Its historical GitGuardian finding was a removed invalid-schema test fixture, not an authentication credential. Staging was not migrated by this release.
