# Spec Delta

## Purpose

Make operational interfaces understandable in English and Amharic while preserving stable domain values, audit evidence, and server behavior.

## ADDED Requirements

### Requirement: Role-scoped language choice
Farm Manager and CEO interfaces SHALL provide English and Amharic, while System Administrator interfaces SHALL remain English-only.

#### Scenario: Farm Manager changes language
- **WHEN** a Farm Manager selects Amharic
- **THEN** the current operational interface changes immediately and the preference is saved for future authenticated sessions

#### Scenario: Administrator signs in
- **WHEN** a System Administrator opens an Admin route
- **THEN** the interface remains English and does not expose the tenant language switch

### Requirement: Complete operational translation
Translated role scopes SHALL include navigation, forms, instructions, validation, task states, notifications, loading, empty, success, error, Governance, Record Checks, and report interface text.

#### Scenario: Amharic validation error
- **WHEN** an Amharic user submits an invalid Today field
- **THEN** the field and recovery instruction are displayed in Amharic without exposing a raw internal code

#### Scenario: Missing translation during development
- **WHEN** a required English or Amharic key is absent from a core translated route
- **THEN** automated validation fails before release

### Requirement: Stable message contract
Server interfaces SHALL return stable language-neutral message or error codes with interpolation parameters and MAY include an English fallback for backward compatibility.

#### Scenario: Stock is insufficient
- **WHEN** an inventory-backed command is rejected for insufficient stock
- **THEN** the client renders the selected-language message using the returned item and quantity parameters

### Requirement: Preserve user evidence
The system SHALL not automatically translate user-entered names, notes, references, decision text, or uploaded evidence.

#### Scenario: CEO reviews an Amharic interface
- **WHEN** a proposal contains an English or Amharic manager note
- **THEN** the interface labels follow the CEO's locale while the original note remains unchanged

### Requirement: Locale-aware presentation
The system SHALL format displayed dates, numbers, units, and ETB values for the selected locale while preserving Gregorian stored dates, language-neutral enum keys, and `Africa/Addis_Ababa` operating-day boundaries.

#### Scenario: Locale changes
- **WHEN** the user switches languages on the same record
- **THEN** presentation formatting changes but record identity, date, quantity, and audit values do not

### Requirement: Approved poultry terminology
Manager-facing translations SHALL use an approved English-Amharic poultry glossary and plain task language rather than unexplained software, accounting, or analytics terminology.

#### Scenario: Technical concept is necessary
- **WHEN** a manager must act on a reconciliation, Governance, or production-standard result
- **THEN** the primary instruction uses an approved plain-language phrase and any technical term appears only as secondary help
