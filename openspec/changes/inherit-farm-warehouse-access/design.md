# Design

Warehouse ownership is determined solely by `warehouses.farm_id`. An active warehouse with a farm inherits the current active manager assignment. A shared warehouse requires a current explicit grant. Both require a same-organization active Farm Manager. Existing CEO read/approval and audited support capabilities remain unchanged.

One database-backed warehouse-access module lists effective scope and evaluates a warehouse for an actor. Browser input never grants authority. RLS uses an auth.uid() wrapper; service-owned operational functions evaluate the verified actor. SQL checks and list readers share the same predicate. No derived grants are stored.

Farm-owned legacy warehouse grants are revoked with a supersession reason and retained as evidence. Existing overlapping farm assignments or unresolved ownership/shared-feeding cases block release; operators must decide. All assignments retain start/expiry semantics. Immediate handover is transactional and stale-safe. Non-overlapping initial future assignments remain supported; future replacements are rejected.

CEO preview returns readable managers, stores, unfinished task labels and a revision. Confirmation revalidates the assignment/tasks under locks. The transaction revokes old access, grants replacement, transfers open work, appends action/audit events and durable notifications. Overdue status and deadlines survive; the new manager must acknowledge. Awaiting-verification and resolved work do not transfer. Revocation without replacement unassigns unfinished work with CEO-visible reassignment evidence.

Application and database release are coordinated. Docker dry runs precede staging. Both Today and legacy workflows use the new rules; a Today feature rollback cannot revive old permissions. Production remains untouched until separately authorized.
