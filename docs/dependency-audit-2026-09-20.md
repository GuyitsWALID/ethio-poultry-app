# Dependency audit — 2026-09-20

`npm audit --json` reported 9 advisories: 1 low, 2 moderate, 5 high, and 1 critical.

The newly pinned `@fission-ai/openspec@1.13.1` is not in any vulnerable dependency path. The reported packages are existing application or build dependencies:

| Package | Severity | Existing path | Safe upgrade candidate |
| --- | --- | --- | --- |
| `next@16.3.0` | Critical | Direct application dependency | `16.3.5` |
| `wrangler@4.120.1` / `miniflare` / `sharp` | High | Direct Cloudflare development toolchain | `wrangler@4.135.0` plus compatible OpenNext verification |
| `browserslist` / `baseline-browser-mapping` | High / moderate | Existing Next, Autoprefixer, and ESLint toolchain | Lockfile refresh after framework verification |
| `js-yaml` | High | Existing ESLint toolchain | Compatible transitive update |
| `postcss-selector-parser` | Low | Existing Tailwind toolchain | Compatible transitive update |
| `qs` | Moderate | Existing OpenNext/Express toolchain | Compatible OpenNext transitive update |

No `npm audit fix` or forced upgrade was run. Framework and Cloudflare upgrades require their own build, deployment, and regression verification and are not silently mixed into the Today workflow change.
