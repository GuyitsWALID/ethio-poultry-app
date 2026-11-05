# Manager Dashboard working baseline

This records the pre-existing uncommitted Manager Dashboard reporting-period work before the `simplify-farm-operations` implementation began.

- Base commit: `9d3e370`
- Diff size: 4 files, 127 insertions, 45 deletions
- Focused verification: 7 tests passed on 2026-09-20

| File | SHA-256 at baseline |
| --- | --- |
| `src/app/api/farm-manager/dashboard/route.ts` | `A46A3E66D3D5E6DFB63C67E5953CF4F1363D228CCD2B43C2A71145912903BDF2` |
| `src/components/farm-manager/production-control-room.tsx` | `DAB364F9F294E6B95A3C88AC34C103D00D7E86F5455DA97EC3B4084A1961F4EC` |
| `src/lib/farm-manager-dashboard.ts` | `38E8A51B0BD658474E79CB0386806A7EC6227628B817055B0ACA0A9FAA691CA2` |
| `tests/farm-manager-dashboard.test.mjs` | `159A6B8EEE5179773C877D3FC05C282895E68BF167257854AC7AB2F02BC4E5B6` |

The Today implementation must not overwrite or revert this diff. Shared-shell work should be reviewed separately from these paths.
