# Recipe Data Contract

The authoritative implementation rules live in:

```text
src/data/projectMilestoneContract.ts
```

That TypeScript file is the single source of truth for:

- Green Acres as the production plant-data authority
- source-plan design intent and role preservation
- recipe substitution order and required comparisons
- hard rejection mismatches
- invasive and suitability screening
- final production-data rules
- milestone preservation
- Recipe Grid Lab physics behavior that must not regress

This document must not restate a competing version of those rules. Tests, recipe-building tools, the production app, and any maintained lab should import or reference the authoritative contract.

## Fixed source set

The current approved recipe source set is:

- 30 illustrated Monrovia recipes from the five supplied guides
- all 11 supplied Gardenia entries
- 41 total production recipes

Do not remove or replace an approved source entry without explicit project-owner approval.

## Production architecture

Production data remains separated by responsibility:

- plant facts keyed by Green Acres plant ID
- recipe facts keyed by recipe ID
- recipe-plant placement records keyed by recipe ID and plant ID

The application, recipe panel, tests, preview, and any maintained lab must consume the same production datasets and shared physics implementation. No parallel production catalog or simplified second physics engine is allowed.

## Completion rule

Recipe work or milestone integration is not complete until the applicable automated checks pass. A visual approximation or partial catalog is not completion.
