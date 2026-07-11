# v84e Visual Coverage Calibration

v84e adjusts the generator density math so the slider matches what the plan looks like on screen.

## Problem fixed

v84d used true geometric circle area:

- zone usable area × density = target coverage area
- target coverage area ÷ average mature plant circle area = plant count

That was mathematically correct, but it still looked too sparse because the rendered plant symbols are not solid filled disks. SVG strokes, transparent fills, labels, clumping, and natural gaps make mathematical 100% read lighter on screen.

## What changed

v84e adds visual coverage calibration:

- Flower bed: mature plant circle counts as about 58% visual coverage
- Grass drift: mature plant circle counts as about 62% visual coverage
- Mixed border / slope: about 66% visual coverage
- Groundcover fill: about 70% visual coverage
- Pool planter / rock garden stay more open
- Hedge row is unchanged because hedge density is edge coverage, not area coverage

This means 100% generates more plants than the raw area math, so it should look closer to full coverage in the actual UI.

## Also adjusted

- Flower bed spacing at high density is tighter.
- Grass drift spacing at high density is tighter.
- The generator allows flower beds and grass drifts to fill closer to edges.
- Debug logs now include `visualCoverageCalibration` and `effectivePlantAreaPx`.

## Goal

Density should still mean coverage, but now it means perceived visual coverage, not abstract geometry coverage.
