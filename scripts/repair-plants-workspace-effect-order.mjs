import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

const effectBlock = `  useEffect(() => {
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

const selectedAnchor = `  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);`;

if (!source.includes(effectBlock)) {
  throw new Error('Workspace effect block not found. No changes made.');
}
if (!source.includes(selectedAnchor)) {
  throw new Error('selectedInstanceId declaration not found. No changes made.');
}

source = source.replace(`${effectBlock}\n`, '');
source = source.replace(selectedAnchor, `${selectedAnchor}\n\n${effectBlock}`);

fs.writeFileSync(path, source);
console.log('Moved the Plants workspace effect below selectedInstanceId state.');
