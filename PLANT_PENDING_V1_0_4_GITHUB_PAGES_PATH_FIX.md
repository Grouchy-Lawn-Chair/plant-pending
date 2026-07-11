# Plant Pending v1.0.4 GitHub Pages path fix

This release fixes public asset loading when the app is hosted under a GitHub Pages project path like:

https://Grouchy-Lawn-Chair.github.io/plant-pending/

Changes:
- Public CSV/JSON fetches now use `import.meta.env.BASE_URL`
- Example plan loading now uses the Vite base path
- Header/loading/print brand images now use the Vite base path
- No package-lock, no dist, no node_modules included

After replacing files, commit and push:

```powershell
git add .
git commit -m "Fix GitHub Pages asset paths"
git push
```
