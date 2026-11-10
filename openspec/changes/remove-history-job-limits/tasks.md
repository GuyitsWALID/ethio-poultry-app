## Implementation

- [x] 17. Paginated archived correction selection, exact reads and draft preservation.
- [x] 18. Stable email claims, bounded retries and ambiguous-result protection.
- [x] 19. Persistent report-schedule failures and starvation-free dispatch.
- [x] 20. Batched authorized Today token/context reads and request-budget regression.

## Verification and release

- [x] Focused runtime tests and PostgreSQL integration/dry run.
- [x] TypeScript, lint, migration lock and clean full-suite/build checks. Final release and post-merge CI passed; 623 tests, zero failures.
- [x] Reviewed production backup and approved migrations. Three migrations applied atomically through `20261110007000`; 113 locked migrations current; 20 protected source fingerprints unchanged.
- [x] Merge master, verify production build and smoke checks. PR #10 merged as `2167b4c`; Cloudflare production and seven live smoke checks passed; monitoring resumed and verified active.

Release evidence: [PR #10](https://github.com/GuyitsWALID/ethio-poultry-app/pull/10#issuecomment-6770600989). Staging parity is a separate open check, not implied by the production release.

No physical-device, signed-in browser or real-provider email acceptance claimed by these checks.
