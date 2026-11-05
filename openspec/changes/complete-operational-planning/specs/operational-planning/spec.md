## ADDED Requirements

### Requirement: Evidence-based recording start
The system SHALL derive opening birds from authoritative dated evidence and SHALL
NOT use mutable current population as a historical opening balance.

#### Scenario: New placement without a Daily Record
- **WHEN** work is recorded on the verified placement day
- **THEN** starting birds are available without a fictional earlier record

#### Scenario: Existing farm joins after placement
- **WHEN** trustworthy earlier history is absent
- **THEN** a manager proposes physical opening counts for CEO approval and exact atomic application
- **AND** original placement and missing coverage remain visible

### Requirement: Egg sales retain source custody
Egg sales SHALL explicitly allocate converted egg quantities to named authorized
flocks in one farm and SHALL retain one financial source record.

#### Scenario: Combined sale
- **WHEN** eggs from multiple flocks are sold together
- **THEN** source rows exactly match the sale and stock/revenue are not counted twice

### Requirement: Durable named-flock scheduling
Schedules SHALL use structured rules and occurrences, support one-time/daily/weekly
plans and SHALL NOT transfer automatically to replacement flocks.

#### Scenario: Manager edits a CEO plan
- **WHEN** a manager tries to edit or cancel a CEO-created rule
- **THEN** editing is denied but authorized outcome recording remains available

#### Scenario: Due work before closure
- **WHEN** a manager finishes a day with unresolved due work
- **THEN** closure requires completion or an explicit reasoned defer/skip outcome
- **AND** completion is backed by authoritative records, not a reminder checkbox

### Requirement: Existing expense sources remain authoritative
Expenses and purchases SHALL reuse cost, template and stock-receipt operations.

#### Scenario: Monthly confirmation retry
- **WHEN** the same monthly template is confirmed concurrently or retried
- **THEN** only one confirmation for its billing month is recorded

### Requirement: Compatible bilingual rollout
New pages SHALL sit under More for enabled users, retain exact legacy links and
use English/Amharic controls with Ethiopian date display and Gregorian wire dates.

#### Scenario: Revoked offline authorization
- **WHEN** queued work refers to changed schedules or revoked access
- **THEN** synchronization fails safely while preserving recoverable drafts
