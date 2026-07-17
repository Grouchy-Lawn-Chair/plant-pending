# Plant Pending Development Rules

Read this file before making any change to this repository.

## Simplest fix first

Before adding observers, DOM patches, correction layers, fallback logic, post-processing, migration scripts, or other workarounds:

1. Reproduce the issue and identify where the incorrect value or behavior originates.
2. Check whether the source can be fixed directly with a small change.
3. Recheck the reasoning and data flow before coding.
4. Prefer the smallest source-level fix that preserves existing behavior.
5. Use a workaround only when a direct fix is impossible or clearly unsafe.
6. Explain why a workaround is necessary before adding it.
7. Remove obsolete workaround code when a direct fix replaces it.

Before every change, ask:

> Is this the simplest, most practical, lowest-risk path?

Prefer small, reversible changes over rewrites. Do not create parallel systems when the existing system can be reorganized or repaired directly.

## Current project mode: UI/UX cleanup only

The active cleanup effort is limited to presentation, navigation, organization, and visibility of existing controls.

### Do not change

Do not add features or alter application behavior.

Do not change:

- Plant databases or catalog data
- Recipes or recipe matching
- Physics or layout engines
- Generator behavior
- Plant spacing, overlap, sizing, or placement rules
- Zone assignment behavior
- Save-file or import/export structures
- Print calculations
- Filtering, scoring, or data-loading logic
- Existing settings, defaults, or meaning
- Gamification behavior

If a requested UI change appears to require any item above, stop and ask before proceeding.

### Allowed changes

Allowed work includes:

- Reorganizing existing controls
- Showing or hiding existing controls based on selection context
- Improving labels, headings, spacing, hierarchy, and empty states
- Adding collapsible Advanced sections
- Removing duplicate access points only when the same function remains clearly available elsewhere
- Extracting large UI sections into smaller presentational components
- Grouping yard setup, area tools, plant tools, generation controls, and plan-review tools without adding workspace tabs

Do not add top-level workspace tabs or create separate app modes for Yard, Areas, Plants, Generate, or Plan. Keep one continuous canvas experience and let the interface respond to what the user selects.

New UI components must receive existing state and callbacks through props. They must not recreate or move business logic unless explicitly approved.

## Complete user-facing changes

Small technical changes are good. Half-finished user experiences are not.

When changing visible terminology, navigation, labels, or interaction language:

1. Treat the change as one complete user-facing batch.
2. Check the top toolbar, side rails, inspector, modals, menus, tooltips, empty states, confirmations, help center, onboarding, print view, and accessibility labels.
3. Use one consistent user-facing term everywhere.
4. Keep internal TypeScript names and saved-data fields unchanged unless a logic refactor is explicitly approved.
5. Do not ship a partial rename that leaves conflicting language in another visible part of the app.

For this app, the user-facing term is **Area**, not **Zone**. Internal names such as `GardenZone`, `selectedZoneId`, and `zoneType` remain unchanged.

Break work into meaningful, testable UI batches, not isolated one-label edits. Each batch should deliver a complete improvement a user can recognize.

## Large-file rule

If a file is difficult or risky to edit because it is too large:

1. Do not keep adding more code to it.
2. Identify a coherent UI-only section.
3. Extract that section into a focused component.
4. Pass existing values and callbacks through props.
5. Preserve behavior exactly.

Possible UI-only components include:

- `ContextInspector.tsx`
- `YardSetupPanel.tsx`
- `AreaInspector.tsx`
- `PlantInspector.tsx`
- `GenerationPanel.tsx`
- `PlanReviewPanel.tsx`
- `AdvancedDisclosure.tsx`

These names are examples, not requirements. Do not create components unless they make the code simpler and safer.

## Contextual interface model

The intended direction is one continuous workspace with contextual controls:

- Nothing selected: show a clear next step or getting-started action
- Area selected: show area settings
- Plant selected: show plant settings
- Multiple plants selected: show group actions
- Planting area selected: make add-plants and generation actions easy to reach
- Yard setup controls: grouped together and collapsed when not needed
- Save, print, legend, notes, and review tools: grouped together
- Advanced and developer controls: hidden by default

The center canvas must remain mounted while UI panels open, close, or change context.

## Incremental implementation order

1. Remove obsolete workspace-tab code.
2. Verify all existing actions still work.
3. Complete terminology and navigation consistency as one batch.
4. Improve contextual visibility without rewriting behavior.
5. Consolidate duplicate UI access points carefully.
6. Extract oversized UI sections when helpful.
7. Polish spacing, hierarchy, onboarding, and help.

Do not combine multiple risky logic phases into one large change. Do combine closely related user-facing wording and navigation changes when splitting them would leave an inconsistent interface.

## Required verification

After each meaningful UI phase, run:

```bash
npm run typecheck
npm run build
```

Also manually verify, as relevant:

- Existing saved plan loads
- Plant placement works
- Plant movement and automatic zone assignment work
- Area drawing and editing work
- Recipe generation works
- Single-item copy and paste work
- Marquee copy and paste work
- Save and reload work
- Export and import work
- Print view opens correctly
- Opening and closing panels does not lose selection, zoom, background, or unsaved state

Do not claim a fix or check is verified unless it was actually run or directly observed.

## Change discipline

Before editing:

1. Read this file.
2. Inspect the relevant existing code.
3. State the smallest intended change.
4. Confirm the change is UI-only.

After editing:

1. Review the diff for accidental logic changes.
2. Run the relevant checks.
3. Report exactly what changed and what was verified.

Keep one authoritative source of truth for each behavior and avoid duplicated or conflicting rules.

When uncertain, stop and ask. Preservation of working behavior is more important than speed.
