# Block free-text feed stock overrides

Audit finding 9; follows `correct-feed-session-voiding` and `contain-operational-security`.

Any nonempty reason previously allowed feed closure to issue unavailable stock. Remove that exception for every actor and entry point. The shared SQL close boundary must reject insufficient stock even when an old client/offline command supplies reason text. No new approval type or negative-stock permission is introduced: resolve genuine missing receipts or discrepancies through existing authorized stock workflows, then retry.

Remove the legacy override input and stop forwarding API reason text. Preserve the SQL argument and Today version-one payload for compatibility/history, never as authority. Localize shortage guidance in English/Amharic. Retain assignment, revision, closure, stock-lock, rollback and idempotency behavior. Preserve historical closures and reasons; provide a read-only review list rather than balancing old ledgers.

Release findings 8–9 together after local/CI checks and a fresh verified production backup. Do not include unrelated local commits in the release unless already present on origin/master.
