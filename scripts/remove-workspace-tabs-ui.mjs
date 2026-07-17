import fs from 'node:fs';

const path = 'src/App.tsx';
const original = fs.readFileSync(path, 'utf8');
const newline = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.replace(/\r\n/g, '\n');

source = source.replace(
  "\nimport { WORKSPACE_CHANGE_EVENT, type WorkspaceId } from './components/WorkspaceTabs';",
  '',
);

source = source.replace(
  "\n  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('plants');",
  '',
);

const effectStart = source.indexOf('\n  useEffect(() => {\n    const handleWorkspaceChange = (event: Event) => {');
if (effectStart !== -1) {
  const effectEndMarker = "\n  }, [selectedInstanceId]);";
  const effectEnd = source.indexOf(effectEndMarker, effectStart);
  if (effectEnd === -1) throw new Error('Workspace effect end not found. No changes written.');
  source = source.slice(0, effectStart) + source.slice(effectEnd + effectEndMarker.length);
}

const wrappedRailStart = `        {activeWorkspace === 'plants' && (\n          <>\n          <aside className="w-16 shrink-0 border-r border-slate-800 bg-[#11161d] px-2 py-3">`;
const plainRailStart = `        <aside className="w-16 shrink-0 border-r border-slate-800 bg-[#11161d] px-2 py-3">`;
source = source.replace(wrappedRailStart, plainRailStart);

const wrappedRailEnd = `        )}\n          </>\n        )}\n\n        <main className="flex-1 min-w-0 bg-[#10161d]">`;
const plainRailEnd = `        )}\n\n        <main className="flex-1 min-w-0 bg-[#10161d]">`;
source = source.replace(wrappedRailEnd, plainRailEnd);

if (source.includes('WorkspaceTabs') || source.includes('activeWorkspace') || source.includes('WORKSPACE_CHANGE_EVENT')) {
  throw new Error('Some workspace-tab wiring remains in src/App.tsx. No changes written.');
}

if (source === original.replace(/\r\n/g, '\n')) {
  console.log('No workspace-tab wiring found in src/App.tsx. Nothing to remove.');
  process.exit(0);
}

fs.writeFileSync(path, newline === '\r\n' ? source.replace(/\n/g, '\r\n') : source);
console.log('Removed workspace-tab wiring and restored the continuous app layout.');
