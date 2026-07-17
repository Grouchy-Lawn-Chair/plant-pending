import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) return;
  if (!source.includes(oldText)) throw new Error(`${label} anchor not found.`);
  source = source.replace(oldText, newText);
}

replaceOnce(
  "import { DEFAULT_FILTERS } from './types/plant';",
  "import { DEFAULT_FILTERS } from './types/plant';\nimport { WORKSPACE_CHANGE_EVENT, type WorkspaceId } from './components/WorkspaceTabs';",
  'workspace import',
);

replaceOnce(
  "  const [leftPanelMode, setLeftPanelMode] = useState<'library' | 'filters' | 'closed'>('library');",
  "  const [leftPanelMode, setLeftPanelMode] = useState<'library' | 'filters' | 'closed'>('library');\n  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('plants');",
  'workspace state',
);

const effectAnchor = `  const [rightInspectorSection, setRightInspectorSection] = useState<'item' | 'canvas' | 'zones' | 'groups' | 'legend' | 'debug' | null>('zones');`;
const effectBlock = `${effectAnchor}

  useEffect(() => {
    const handleWorkspaceChange = (event: Event) => {
      const workspace = (event as CustomEvent<WorkspaceId>).detail;
      setActiveWorkspace(workspace);
      if (workspace === 'plants') {
        setLeftPanelMode(current => current === 'closed' ? 'library' : current);
        if (selectedInstanceId) setRightInspectorSection('item');
      }
    };

    window.addEventListener(WORKSPACE_CHANGE_EVENT, handleWorkspaceChange);
    return () => window.removeEventListener(WORKSPACE_CHANGE_EVENT, handleWorkspaceChange);
  }, [selectedInstanceId]);`;
replaceOnce(effectAnchor, effectBlock, 'workspace effect');

replaceOnce(
  `        <aside className="w-16 shrink-0 border-r border-slate-800 bg-[#11161d] px-2 py-3">`,
  `        {activeWorkspace === 'plants' && (
          <>
          <aside className="w-16 shrink-0 border-r border-slate-800 bg-[#11161d] px-2 py-3">`,
  'Plants workspace left rail',
);

replaceOnce(
  `        )}

        <main className="flex-1 min-w-0 bg-[#10161d]">`,
  `        )}
          </>
        )}

        <main className="flex-1 min-w-0 bg-[#10161d]">`,
  'Plants workspace left panel close',
);

fs.writeFileSync(path, source);
console.log('Connected the Plants workspace to the existing plant library and filter panels.');
