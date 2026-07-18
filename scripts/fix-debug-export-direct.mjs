import fs from 'node:fs';

const planFile = 'src/components/PlanDetails.tsx';
const diagnosticsFile = 'src/MobileUiDiagnostics.tsx';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}
function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const diagnostics = read(diagnosticsFile);
let diagnosticsText = diagnostics.text;

const storeHelper = `
type UiDebugStore = {
  interactions: Array<Record<string, unknown>>;
  snapshots: TestSnapshot[];
};

function uiDebugStore(): UiDebugStore {
  const debugWindow = window as typeof window & { __plantPendingUiDebug?: UiDebugStore };
  if (!debugWindow.__plantPendingUiDebug) {
    debugWindow.__plantPendingUiDebug = { interactions: [], snapshots: [] };
  }
  return debugWindow.__plantPendingUiDebug;
}

function recordUiInteraction(type: string, target: EventTarget | null) {
  const element = target instanceof Element ? target : null;
  const control = element?.closest('button,a,input,select,textarea,[role="button"],[role="dialog"],details,summary') || element;
  const rect = control instanceof HTMLElement ? control.getBoundingClientRect() : null;
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    tag: control?.tagName?.toLowerCase() || null,
    text: (control?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
    ariaLabel: control?.getAttribute?.('aria-label') || null,
    title: control?.getAttribute?.('title') || null,
    value: control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement ? control.value : null,
    checked: control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio') ? control.checked : null,
    rect: rect ? { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
  };
  const store = uiDebugStore();
  store.interactions.push(entry);
  if (store.interactions.length > 500) store.interactions.splice(0, store.interactions.length - 500);
}
`;

if (!diagnosticsText.includes('function uiDebugStore()')) {
  const importEnd = diagnosticsText.indexOf('\n\ntype RectRecord');
  if (importEnd < 0) throw new Error('Could not find MobileUiDiagnostics type anchor. No files written.');
  diagnosticsText = diagnosticsText.slice(0, importEnd) + '\n' + storeHelper + diagnosticsText.slice(importEnd);
}

if (!diagnosticsText.includes('store.snapshots.push(snapshot)')) {
  const anchor = "      recordRecipeDebug(host, 'ui.layout.snapshot', { reason, snapshotNumber: snapshotCount, ...details }, snapshot);";
  if (!diagnosticsText.includes(anchor)) throw new Error('Could not find UI snapshot recording anchor. No files written.');
  diagnosticsText = diagnosticsText.replace(anchor, `${anchor}\n      const store = uiDebugStore();\n      store.snapshots.push(snapshot);\n      if (store.snapshots.length > 40) store.snapshots.splice(0, store.snapshots.length - 40);`);
}

if (!diagnosticsText.includes("recordUiInteraction('click'")) {
  const clickAnchor = '    const onClick = (event: MouseEvent) => {';
  if (!diagnosticsText.includes(clickAnchor)) throw new Error('Could not find click listener anchor. No files written.');
  diagnosticsText = diagnosticsText.replace(clickAnchor, `${clickAnchor}\n      recordUiInteraction('click', event.target);`);
}

if (!diagnosticsText.includes('const onInput = (event: Event)')) {
  const resizeAnchor = "    const onResize = () => schedule('viewport-changed', 550);";
  if (!diagnosticsText.includes(resizeAnchor)) throw new Error('Could not find resize listener anchor. No files written.');
  diagnosticsText = diagnosticsText.replace(resizeAnchor, `    const onInput = (event: Event) => {\n      recordUiInteraction(event.type, event.target);\n      schedule(\`after-\${event.type}\`, 500);\n    };\n    const onResize = () => schedule('viewport-changed', 550);`);
}

if (!diagnosticsText.includes("document.addEventListener('input', onInput, true)")) {
  const listenerAnchor = "    document.addEventListener('click', onClick, true);";
  diagnosticsText = diagnosticsText.replace(listenerAnchor, `${listenerAnchor}\n    document.addEventListener('input', onInput, true);\n    document.addEventListener('change', onInput, true);`);
  const cleanupAnchor = "      document.removeEventListener('click', onClick, true);";
  diagnosticsText = diagnosticsText.replace(cleanupAnchor, `${cleanupAnchor}\n      document.removeEventListener('input', onInput, true);\n      document.removeEventListener('change', onInput, true);`);
}

if (!diagnosticsText.includes("window.addEventListener('plant-pending-debug-export'")) {
  const orientationAnchor = "    const onOrientation = () => schedule('orientation-changed', 700);";
  diagnosticsText = diagnosticsText.replace(orientationAnchor, `${orientationAnchor}\n    const onExportRequested = () => schedule('export-requested', 20);`);
  const visualAnchor = "    window.visualViewport?.addEventListener('resize', onResize);";
  diagnosticsText = diagnosticsText.replace(visualAnchor, `${visualAnchor}\n    window.addEventListener('plant-pending-debug-export', onExportRequested);`);
  const visualCleanupAnchor = "      window.visualViewport?.removeEventListener('resize', onResize);";
  if (diagnosticsText.includes(visualCleanupAnchor)) {
    diagnosticsText = diagnosticsText.replace(visualCleanupAnchor, `${visualCleanupAnchor}\n      window.removeEventListener('plant-pending-debug-export', onExportRequested);`);
  } else {
    const disconnectAnchor = '      observer.disconnect();';
    diagnosticsText = diagnosticsText.replace(disconnectAnchor, `${disconnectAnchor}\n      window.removeEventListener('plant-pending-debug-export', onExportRequested);`);
  }
}

const plan = read(planFile);
let planText = plan.text;
const start = planText.indexOf('  const downloadDebugPackage = ');
const end = planText.indexOf('\n\n  // Handle file import', start);
if (start < 0 || end < 0) throw new Error('Could not find downloadDebugPackage function. No files written.');

const replacement = `  const downloadDebugPackage = async () => {
    window.dispatchEvent(new CustomEvent('plant-pending-debug-export'));
    await new Promise(resolve => window.setTimeout(resolve, 900));

    const debugWindow = window as typeof window & {
      __plantPendingUiDebug?: {
        interactions?: Array<Record<string, unknown>>;
        snapshots?: TestSnapshot[];
      };
    };
    const uiInteractions = debugWindow.__plantPendingUiDebug?.interactions || [];
    const uiSnapshots = debugWindow.__plantPendingUiDebug?.snapshots || [];
    const allSnapshots = [...debugSnapshots, ...uiSnapshots]
      .filter((snapshot, index, items) => items.findIndex(item => item.id === snapshot.id) === index)
      .slice(-40);

    const packageData = {
      createdAt: new Date().toISOString(),
      app: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      },
      planSummary: {
        name: currentPlanName,
        placedPlants: placedPlants.length,
        zones: zones.length,
        plantingGroups: plantingGroups.length,
        warnings: warnings.length,
        notesLength: notes.length,
        selectedZoneId,
        selectedInstanceId,
        zoneShapesVisible,
        debugSnapshots: allSnapshots.length,
        uiInteractions: uiInteractions.length,
      },
      zones,
      plantingGroups,
      placedPlants: placedPlants.map(item => ({
        ...item,
        plantName: plants.find(plant => plant.id === item.plantId)?.commonName || plants.find(plant => plant.id === item.plantId)?.botanicalName || null,
      })),
      warnings,
      testLog,
      uiInteractions,
      debugSnapshots: allSnapshots,
    };

    const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = \`garden-planner-debug-package-\${new Date().toISOString().replace(/[:.]/g, '-')}\.json\`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };`;

planText = planText.slice(0, start) + replacement + planText.slice(end);

write(diagnosticsFile, diagnosticsText, diagnostics.newline);
write(planFile, planText, plan.newline);
console.log('Debug export now records clicks, inputs, menu/layout changes, and UI screenshots.');
console.log('The export waits for a final screenshot and includes uiInteractions plus up to 40 debugSnapshots.');
