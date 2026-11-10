- [x] 1 Exclude voided sessions at every feed-close source read without changing other guards or grants.
- [x] 2 Add regressions for voided completed/pending sessions, no active sessions, feed type, stock, retry and reopen/reclose.
- [x] 3 Add a read-only historical closure review query; do not rewrite ledger history.
- [x] 4 Validate migration and focused feed/security regressions in disposable Docker; run relevant static/unit checks.
- [x] 5 Separately authorized production release and remote preflight. PR #6 merged as `b95964d`; verified backup, atomic migrations, source preservation, clean CI/build and live smoke passed. The read-only preflight found zero voided-closure candidates, so no historical correction or ledger rewrite was performed or required by that result.

Evidence: [PR #6](https://github.com/GuyitsWALID/ethio-poultry-app/pull/6). Future affected records still require the governed correction workflow.
