## ADDED Requirements

### Requirement: Preserve canonical placement identities
Farm-scoped shared cycles SHALL group existing per-house batches without replacing canonical identifiers. Legacy mapping SHALL be unambiguous or require operator review. Cycles SHALL not span farms or mix unrelated cohorts.

#### Scenario: Independent house cycle
- **WHEN** one cycle closes
- **THEN** unrelated cycles SHALL remain unchanged; every member of the selected shared cycle SHALL close together.

### Requirement: Approved physical closure
The manager SHALL propose, CEO SHALL approve and manager SHALL apply. One PostgreSQL transaction SHALL validate assignment, approval, revisions, final Daily Records, closed feeding and exact physical accounting, append evidence/allocations, update only approved final fields and archive all members exactly once. Closure SHALL not create financial sales, mortality or duplicate culls. Non-bird sale units SHALL require approved physical head-count evidence. Allocation capacity SHALL prevent reuse. Invalidating later edits SHALL require governed review and SHALL not resurrect population automatically.

#### Scenario: Stale or inconsistent sources
- **WHEN** approval revisions, remaining population, sale capacity or final records disagree
- **THEN** application SHALL fail without partial mutations or balancing adjustments.

### Requirement: Actual-date safe placement
New cycle creation SHALL require verified completion/archival of every applicable predecessor, eligible empty houses, actual date warning/confirmation, arrival age and separate starting counts. Quarantine SHALL occupy a house. Same-day turnover SHALL prove completion before placement by timestamps. Future arrivals SHALL not activate. Backdating SHALL follow operating/Governance windows. Creation SHALL be atomic and concurrent conflicting placements SHALL fail.

#### Scenario: Legacy operation
- **WHEN** an old branch replacement caller or unsafe approval attempts application
- **THEN** it SHALL use these guards or return resubmission instructions, regardless of Today rollout.

### Requirement: Exceptional movement and recovery
Whole-flock approved movement SHALL preserve origin, record transfer/approval history, validate the current movement chain and require an empty destination without mixing. Today SHALL include both same-day old/new identities and reject stale/completed offline writes without deleting drafts. Forward-only release SHALL pass preflight, Docker, staging and authenticated validation; production SHALL require separate approval.

#### Scenario: Completed-flock draft reconnects
- **WHEN** a preserved offline draft targets a flock completed before synchronization
- **THEN** reject the mutation without changing records or deleting the draft; identify the lifecycle conflict for review.
