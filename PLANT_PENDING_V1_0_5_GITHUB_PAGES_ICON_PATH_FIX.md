# Plant Pending v1.0.5 GitHub Pages icon path fix

This fixes SVG asset paths for GitHub Pages project hosting.

Changes:
- Plant top-down SVG icons use Vite `BASE_URL`
- Rock SVG icons use Vite `BASE_URL`
- Old saved/example plans with root-relative rock paths are normalized at render time
- Keeps previous v1.0.4 public CSV/JSON path fixes
- No package-lock, no dist, no node_modules included
