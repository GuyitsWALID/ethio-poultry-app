## ADDED Requirements

### Requirement: One authorized visual workspace
The system SHALL provide Farm performance at `/app/reports` with Overview, Production, Feeding, Health, Stock, Sales & Costs and Saved reports, preserving URL context and existing authoritative ledgers.
#### Scenario: Inspect a selected scope
- **WHEN** an authorized user selects dates and a location
- **THEN** visuals SHALL show complete authorized evidence with units, coverage, explanations and in-page figures, without silently changing the range or requiring a feeding batch.

### Requirement: Safe reporting evidence
The system MUST enforce effective farm/store access, include verified historical lifecycle evidence, use inclusive Addis dates and fail explicitly instead of reporting capped totals.
#### Scenario: Shared store without permission
- **WHEN** a manager has farm access but no permission for a shared store
- **THEN** its stock and warehouse expenses SHALL NOT enter any reporting result or snapshot available to that manager.

### Requirement: Immutable, retry-safe saved analysis
The system SHALL save versioned all-topic server evidence and audit atomically, claim scheduled work, revalidate current authority and paginate authorized snapshots. Legacy unverifiable cross-store snapshots MUST remain CEO-only.
#### Scenario: Retry report generation
- **WHEN** the same generation operation is retried or scheduled concurrently
- **THEN** no duplicate completed snapshot or unaudited completion SHALL be created.

### Requirement: Accessible compatible delivery
The system SHALL preserve exact legacy targets, disabled/Admin presentation and EN/AM calendar behavior, provide accessible chart alternatives and release through validated staging and notmain before separately approved production.
#### Scenario: Missing evidence
- **WHEN** evidence is absent or a section fails
- **THEN** the interface SHALL distinguish missing, empty and failed states rather than display a false zero or healthy outcome.
