# v114a clean install note

This zip removes package-lock.json so `npm install` uses your normal npm registry instead of any lockfile-resolved registry.

Recommended install:

```powershell
npm install --registry=https://registry.npmjs.org
npm run dev
```

If a partial node_modules folder exists from a failed install, delete node_modules first.
