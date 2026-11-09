# Exclude voided sessions from feed closure

Audit finding 8; follows `contain-operational-security` and preserves `simplify-farm-operations` interfaces.

The shared `close_feed_day` function must use only non-voided feeding sessions for existence, completion, planned/actual totals, feed-type selection, stock validation and stock posting. Keep current assignment checks, missed-session rules, operating locks, Daily Record preservation, transactionality, private grants and repeat/reopen behavior.

Today, Feed Control and reporting readers already exclude voided sessions. Patch their authoritative database close boundary rather than duplicating rules in each caller. The forward migration refuses an unexpected function definition and does not rewrite closed days or any source/stock rows. The read-only preflight lists existing closures that need exact governed review; it is not a repair script.

Preserve unrelated uncommitted Today/opening-count changes. Finding 9 (stock overrides), other audit findings, automatic historical rebalancing and remote deployment are outside this change.
