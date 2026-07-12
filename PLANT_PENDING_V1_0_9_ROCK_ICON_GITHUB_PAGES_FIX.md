# Plant Pending v1.0.9 Rock icon GitHub Pages fix

Fixes a double-base-path bug for newly placed rocks on GitHub Pages.

Problem:
- Newly placed rocks were saved as `/plant-pending/rocks-icons/rockN.svg`
- The renderer saw the leading slash and added the Vite base path again
- Result: `/plant-pending/plant-pending/rocks-icons/rockN.svg`

Fix:
- New rocks are saved with relative paths: `rocks-icons/rockN.svg`
- Renderers normalize old `/rocks-icons/...`, newer `/plant-pending/rocks-icons/...`, and relative paths
- The helper does not double-prefix paths that already include the app base URL
