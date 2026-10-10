## ADDED Requirements

### Requirement: One selected inline profile
The workspace SHALL visibly identify selectable flocks with keyboard focus and 44px minimum touch targets. It SHALL expand one selected profile below lineage without navigation, with reduced-motion support and readable lifecycle/performance states. Today-enabled managers SHALL not see duplicate registry or generic operational record links. History SHALL be disabled until implemented.

#### Scenario: Missing deep link
- **WHEN** a requested flock is missing or unauthorized
- **THEN** show unavailable, never another flock's profile.

### Requirement: Period evidence
The profile SHALL default to 30 days and support 7/30/90. It SHALL distinguish current context, selected-period results and dated current work. Periods SHALL exclude pre-placement dates and end at verified completion for archived flocks. Missing evidence SHALL not become zero. Age SHALL include arrival age and weight targets SHALL use measurement age. Rates SHALL use paired evidence and summed denominators rather than averaging daily percentages.

#### Scenario: Partial records
- **WHEN** daily or feeding evidence is incomplete
- **THEN** show coverage and missing dates alongside available results.

### Requirement: Useful next steps
The combined performance/attention card SHALL list all supported concerns ordered by existing severity. Actions SHALL identify the exact task/flock/date or authorized historical correction. Archived flocks SHALL not receive today's entry instructions. New controls SHALL be English/Amharic with locale-aware calendar display.

#### Scenario: Several supported concerns
- **WHEN** missing records, unfinished feeding and a performance concern coexist
- **THEN** list each concern with its evidence and named destination, ordered by severity; do not replace them with one generic Daily Record link.
