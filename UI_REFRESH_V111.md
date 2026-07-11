# Garden Planner v111 – spacing + inspector cleanup

## Changes

- Plant card metric tiles keep a 50px height.
- Compact Size / Water / Sun tiles no longer show redundant text labels under the icons.
- Price detail tile stays text-only.
- Removed the visible CA Native quick filter because current Green Acres data does not map cleanly to that flag.
- CA Native logic is still repaired behind the scenes for future use, using native-garden research scores as a fallback.
- Removed the bottom tool-help message from the canvas toolbar.
- Moved tool help into the top app header area.
- Removed the redundant canvas status strip above the canvas.
- Removed Hide Inspector controls; the right inspector rail stays visible.
- Renamed Plant density to Fullness in Zone Settings.
- Continued dark-mode cleanup for zone cards and planting group controls.

## Validation

- npm run typecheck
- npm run build
