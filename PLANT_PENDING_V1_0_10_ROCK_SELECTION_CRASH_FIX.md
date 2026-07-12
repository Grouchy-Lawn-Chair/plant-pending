# Plant Pending v1.0.10 Rock selection crash fix

Fixes a crash when selecting a rock/plant on the GitHub Pages build.

Problem:
- PlanDetails still referenced an old local setter named `setInspectorSection`
- That setter no longer exists after the right rail became parent-controlled
- Selecting a placed item tried to call it and React crashed to a blank white screen

Fix:
- Replaced stale `setInspectorSection(...)` calls with `onInspectorSectionChange(...)`
- Selecting rocks/plants now opens the Selection panel without crashing
- Keeps the v1.0.9 rock path fix
