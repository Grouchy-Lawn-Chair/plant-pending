# Phase 1, Zone Intelligence

## Status

Initiated July 12, 2026.

Working branch: `phase-1-zone-intelligence`

Tracking issue: #1

## Objective

Make every drawn planting zone understandable as an outdoor space before later systems choose planting frameworks, recipes, groups, or individual plants.

Plant Pending should know what a zone is, what it needs to accomplish, what conditions apply, and what limits must be respected.

## Existing foundation

The current zone model already supports polygon geometry, zone type, sun exposure, afternoon sun, water preference, planting style, density, seed, layout mode, planting group, visibility, color, opacity, and notes.

Phase 1 extends this model. It does not replace it.

## New zone intelligence model

### Purpose

Each planting zone receives one primary purpose.

- General planting bed
- Pool planting
- Fire pit
- Patio or dining edge
- Privacy screen
- Hedge
- Slope
- Foundation planting
- Path or border
- Vegetable garden edge
- Wildlife or pollinator area
- Custom

### Functional goals

A zone may have multiple goals.

- Privacy
- Screening
- Shade
- Framing
- Softening
- Erosion control
- Pool-friendly planting
- Low maintenance
- Seasonal color
- Habitat value

### Physical constraints

- Desired minimum plant height
- Desired maximum plant height
- Maximum plant width
- Evergreen preference
- Flowering preference
- Pollinator tolerance
- Pool debris sensitivity
- Pet considerations
- Maintenance tolerance

### Derived zone profile

The app will generate a concise profile from the structured values. Later phases will consume this profile rather than interpreting raw form controls independently.

The profile should answer:

1. What kind of outdoor space is this?
2. What must the planting accomplish?
3. What conditions shape the design?
4. What constraints must not be violated?
5. What broad planting structure is likely appropriate?

## Compatibility rules

- Existing plans must continue to load.
- Missing fields receive safe defaults.
- Import and export preserve all new fields.
- Duplicated zones copy their intelligence settings.
- Existing plant placement and generation behavior must not change during this phase.
- New fields remain optional until the user edits them.

## Implementation order

1. Extend the `GardenZone` type with a versioned zone intelligence object.
2. Add default and normalization helpers.
3. Apply normalization when plans are loaded or imported.
4. Extend the existing zone properties interface.
5. Add a concise Zone Profile summary.
6. Verify save, load, import, export, duplicate, and print behavior.
7. Add focused tests or repeatable manual checks for old and new plan files.

## Phase boundary

Phase 1 does not select plants, create planting recipes, orient a spatial grid, generate groups, or place individual plants. Those capabilities belong to later phases.

## Completion condition

A user can describe a zone's purpose, conditions, goals, and constraints, save or export the plan, reload or import it, and recover the same structured Zone Profile without altering current planning behavior.
