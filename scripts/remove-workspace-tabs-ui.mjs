import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');
const original = source;

source = source.replace(
  /\nimport \{ WORKSPACE_CHANGE_EVENT, type WorkspaceId \} from '\.\/components\/WorkspaceTabs';/,
  '',
);

source = source.replace(
  /\n  const \[activeWorkspace, setActiveWorkspace\] = useState<WorkspaceId>\('plants'\);/,
  '',
);

source = source.replace(
  /\n  useEffect\(\(\) => \{\n    const handleWorkspaceChange = \(event: Event\) => \{[\s\S]*?window\.removeEventListener\(WORKSPACE_CHANGE_EVENT, handleWorkspaceChange\);\n  \}, \[selectedInstanceId\]\);\n/,
  '\n',
);

source = source.replace(
  /\n        \{activeWorkspace === 'plants' && \(\n          <>\n          (<aside className="w-16 shrink-0 border-r border-slate-800 bg-\[#11161d\] px-2 py-3">)/,
  '\n        $1',
);

source = source.replace(
  /\n        \)\}\n          <\/>
        \)\}\n\n        <main className="flex-1 min-w-0 bg-\[#10161d\]">/,
  '\n        )}\n\n        <main className="flex-1 min-w-0 bg-[#10161d]">',
);

if (source === original) {
  console.log('No workspace-tab wiring found in src/App.tsx. Nothing to remove.');
} else {
  fs.writeFileSync(path, source);
  console.log('Removed workspace-tab wiring and restored the continuous app layout.');
}
