# Recipe Data Contract

This document is the permanent source-of-truth contract for importing and maintaining Plant Pending recipes.

## Source set

Use only the Monrovia PDFs explicitly supplied for the current import pass:

- Best Landscape Plans 2025
- Monrovia Fall Guide 2023
- Ultimate Spring Planning Guide 2023
- Monrovia Weekend Project Guide 2024
- Backyard Habitat Guide 2024

Do not import Shades of Beautiful as recipe plans because those guides do not contain the illustrated planting-plan format used by the recipe engine.

Use all 11 Gardenia URLs supplied by the project owner. Do not remove the Salvia 'Caradonna' entry or make editorial deletions without explicit approval.

## What counts as a recipe

A recipe is an illustrated plan view or container plan followed by its plant list.

Include:

- illustrated primary landscape plans
- illustrated weekend project plans
- illustrated container plans

Do not create separate recipes from alternative-choice pages. Alternative choices are candidate substitutions only.

## Matching workflow

For every source plant, compare against the Plant Pending Green Acres dataset in this order:

1. exact cultivar
2. same species or close cultivar
3. same plant type, mature form, color, mature size, water need, sun exposure, and design role
4. best functional substitute

Then check suitability for Orangevale and screen for invasive, aggressive-spreading, thorny, toxic, high-fire-risk, or otherwise unsuitable plants.

If the source plant is unsuitable or unavailable, use the safer Green Acres substitute as the recipe plant. The live recipe does not need to retain the rejected original plant as a selectable option.

## Layout behavior

Plant display size must come from potential mature width in the Plant Pending plant dataset. Do not shrink or enlarge plants merely to match a source illustration.

Recipe data must preserve the source design grammar through:

- front, middle, back, and accent roles
- attraction to selected front or back edges
- scatter versus ordered/stacked placement
- clump attraction and clump depth
- hedge or row behavior
- coverage or mixture proportions
- gravity, padding, overlap allowance, and seed variation

The tested Elegant Privacy Hedge Border behavior must be migrated into the production recipe configuration without copying fixed pixel sizes from the old lab.

## Storage architecture

All production recipes must live in one authoritative dataset beside the other Plant Pending data files.

The application, recipe panel, preview, tests, and any maintained lab must import that same dataset. No production recipe may be hand-copied into a second catalog.

Historical standalone fixtures may remain only if clearly marked as non-production and excluded from catalog counts.

## Required validation

The import is not complete until automated checks confirm:

- every expected source plan has exactly one recipe record
- all 11 Gardenia entries are present
- recipe IDs are unique
- every recipe contains at least one plant
- every Green Acres plant ID resolves in the current Plant Pending plant dataset
- every plant has a mature width and valid layer
- mixture percentages are valid or intentionally normalized
- source PDF and page are recorded for Monrovia recipes
- no production recipe definitions exist outside the master dataset

Never reduce the recipe count, delete a supplied entry, or replace an existing reviewed recipe without an explicit instruction from the project owner.