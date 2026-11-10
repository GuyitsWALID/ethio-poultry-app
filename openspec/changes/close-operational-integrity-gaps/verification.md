# Verification

Final Docker copy: `ethio_integrity_20261110_406a9a56`; normal local and source fixture databases unchanged.

Both forward migrations applied successfully. The combined SQL run covered all integration files; seven affected files were rerun on the final fresh copy after fixture/schedule compatibility fixes. New checks cover request replay, changed-payload conflict, amounts, one audit, rollback on audit failure, private grants, revocation, configurable cutoff without a scheduler lock row, future dates, closed days, approved correction and original-date protection.

Focused JavaScript: 11 passed, including 1,201 inventory items / 1,501 movements and failure on a later stock page. TypeScript passed.

Working-tree full suite: 614 tests, 612 passed. Two failures reference the unrelated uncommitted BirdCheckCard rewrite (queued-submit and error-map source contracts). Those edits are excluded from this release. Clean release CI must pass before production.

No signed-in production business writes performed. Production backup/migration and final clean CI evidence must be recorded at release; unfinished release checkboxes remain open until then.
