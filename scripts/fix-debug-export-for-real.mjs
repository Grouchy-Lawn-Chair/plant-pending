import fs from 'node:fs';

const appPath = 'src/App.tsx';
const diagnosticsPath = 'src/MobileUiDiagnostics.tsx';
const STORAGE_KEY = 'plant-pending-ui-debug-records';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}
function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const app = read(appPath);
let appText = app.text;

if (!appText.includes('plant-pending-ui-debug-records')) {
  const createdAtIndex = appText.indexOf('createdAt: new Date().toISOString()');
  if (createdAtIndex < 0) throw new Error('Could not find debug package object. No files written.');
  const snapshotsIndex = appText.indexOf('debugSnapshots', createdAtIndex);
  if (snapshotsIndex < 0 || snapshotsIndex - createdAtIndex > 5000) throw new Error('Could not find debugSnapshots in debug package. No files written.');

  const lineStart = appText.lastIndexOf('\n', snapshotsIndex) + 1;
  const lineEnd = appText.indexOf('\n', snapshotsIndex);
  const originalLine = appText.slice(lineStart, lineEnd);
  const indent = originalLine.match(/^\s*/)?.[0] || '';
  const replacement = `${indent}debugSnapshots: [\n${indent}  ...debugSnapshots,\n${indent}  ...(() => {\n${indent}    try {\n${indent}      const stored = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '[]');\n${indent}      return Array.isArray(stored) ? stored.map((item: any) => item.snapshot).filter(Boolean) : [];\n${indent}    } catch {\n${indent}      return [];\n${indent}    }\n${indent}  })(),\n${indent}],\n${indent}uiInteractions: (() => {\n${indent}  try {\n${indent}    const stored = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '[]');\n${indent}    return Array.isArray(stored) ? stored.map((item: any) => item.interaction).filter(Boolean) : [];\n${indent}  } catch {\n${indent}    return [];\n${indent}  }\n${indent})(),`;
  appText = appText.slice(0, lineStart) + replacement + appText.slice(lineEnd);
}

const diagnostics = read(diagnosticsPath);
let diagnosticsText = diagnostics.text;

if (!diagnosticsText.includes(`const UI_DEBUG_STORAGE_KEY = '${STORAGE_KEY}'`)) {
  diagnosticsText = diagnosticsText.replace(
    'const MAX_UI_SNAPSHOTS = 30;',
    `const MAX_UI_SNAPSHOTS = 40;\nconst UI_DEBUG_STORAGE_KEY = '${STORAGE_KEY}';\n\nfunction storedRecords(): any[] {\n  try {\n    const parsed = JSON.parse(localStorage.getItem(UI_DEBUG_STORAGE_KEY) || '[]');\n    return Array.isArray(parsed) ? parsed : [];\n  } catch {\n    return [];\n  }\n}\n\nfunction persistRecord(record: any) {\n  const next = [...storedRecords().slice(-(MAX_UI_SNAPSHOTS - 1)), record];\n  localStorage.setItem(UI_DEBUG_STORAGE_KEY, JSON.stringify(next));\n}\n\nfunction controlDescription(target: Element | null) {\n  const control = target?.closest('button,a,input,select,textarea,[role="button"],[role="tab"],summary');\n  if (!control) return null;\n  return {\n    tag: control.tagName.toLowerCase(),\n    text: (control.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 140),\n    ariaLabel: control.getAttribute('aria-label'),\n    title: control.getAttribute('title'),\n    value: control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement ? control.value : undefined,\n  };\n}`,
  );

  diagnosticsText = diagnosticsText.replace(
    "      recordRecipeDebug(host, 'ui.layout.snapshot', { reason, snapshotNumber: snapshotCount, ...details }, snapshot);",
    `      const interaction = {\n        id: snapshot.id,\n        timestamp: snapshot.timestamp,\n        reason,\n        details,\n      };\n      persistRecord({ interaction, snapshot });\n      recordRecipeDebug(host, 'ui.layout.snapshot', { reason, snapshotNumber: snapshotCount, ...details }, snapshot);`,
  );

  diagnosticsText = diagnosticsText.replace(
    `    const onClick = (event: MouseEvent) => {\n      const target = event.target instanceof Element ? event.target : null;\n      const button = target?.closest('button,[role="button"]');\n      const text = button?.textContent?.trim().replace(/\\s+/g, ' ').slice(0, 100) || 'unknown-control';\n      const exportRequested = /export.*debug|debug.*package/i.test(text);\n      schedule(exportRequested ? 'export-requested' : \`after-click:\${text}\`, exportRequested ? 40 : 500);\n    };`,
    `    const onClick = (event: MouseEvent) => {\n      const target = event.target instanceof Element ? event.target : null;\n      const control = controlDescription(target);\n      const text = control?.text || control?.ariaLabel || control?.title || 'unknown-control';\n      const exportRequested = /export.*debug|debug.*package/i.test(text);\n      schedule(exportRequested ? 'export-requested' : \`click:\${text}\`, exportRequested ? 40 : 280);\n    };\n    const onChange = (event: Event) => {\n      const target = event.target instanceof Element ? event.target : null;\n      const control = controlDescription(target);\n      const text = control?.text || control?.ariaLabel || control?.title || control?.tag || 'unknown-control';\n      schedule(\`change:\${text}\`, 280);\n    };`,
  );

  diagnosticsText = diagnosticsText.replace(
    `    document.addEventListener('click', onClick, true);`,
    `    document.addEventListener('click', onClick, true);\n    document.addEventListener('change', onChange, true);\n    document.addEventListener('input', onChange, true);`,
  );

  diagnosticsText = diagnosticsText.replace(
    `      observer.disconnect();`,
    `      observer.disconnect();\n      document.removeEventListener('click', onClick, true);\n      document.removeEventListener('change', onChange, true);\n      document.removeEventListener('input', onChange, true);`,
  );
}

write(appPath, appText, app.newline);
write(diagnosticsPath, diagnosticsText, diagnostics.newline);
console.log('Debug export now includes persisted UI interactions and screenshots.');
console.log('It records clicks, input/change events, menu/layout mutations, resize, rotation, and a final export-time screenshot.');
