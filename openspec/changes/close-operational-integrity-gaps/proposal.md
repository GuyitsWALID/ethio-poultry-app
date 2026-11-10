# Close operational integrity gaps (audit findings 12–14)

Linked to `simplify-farm-operations` and `contain-operational-security`.

12. Make non-egg sales retry-safe using the existing sale request identity/index. Legacy and Today call one transactional writer; changed payloads conflict and audit failure rolls back the sale. Preserve egg custody and controlled support.
13. Enforce the organization's Addis Ababa grace/cutoff on actual operational evidence even if the lock scheduler has not run. Check original and destination dates. Preserve exact approved Governance corrections and planned vaccination/biosecurity schedules.
14. Read every authorized inventory item, warehouse, movement and relevant physical-count session before presenting Today stock choices/balances. Reuse bounded, stable pagination; never return partial totals after a failed page.

No business-data rewrite, permission expansion, new dependency or unrelated Today redesign. Release only after focused regressions, migration dry run and combined checks. Production requires fresh verified backup and exact migration allowlist. Existing unrelated work stays uncommitted.
