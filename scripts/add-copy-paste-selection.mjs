import fs from 'node:fs';

function updatePlanDetails() {
  const path = 'src/components/PlanDetails.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = source.replace('{ displayWidthFt: null }', '{ displayWidthFt: undefined }');
  fs.writeFileSync(path, source);
}

function updateApp() {
  const path = 'src/App.tsx';
  let source = fs.readFileSync(path, 'utf8');

  if (!source.includes('const copiedPlacedPlantsRef = useRef<PlacedPlant[]>([]);')) {
    const refsPattern = /(\s*const \[selectedInstanceIds, setSelectedInstanceIds\] = useState<string\[\]>\(\[\]\);\r?\n)/;
    if (!refsPattern.test(source)) throw new Error('Selection state anchor not found.');
    source = source.replace(
      refsPattern,
      `$1  const copiedPlacedPlantsRef = useRef<PlacedPlant[]>([]);\n  const pasteGenerationRef = useRef(0);\n`,
    );
  }

  if (!source.includes('const handleCopySelectedPlacedPlants = useCallback')) {
    const insertPattern = /\s*const handleCreatePlantingGroup = useCallback\(\(name: string\) => \{/;
    const match = source.match(insertPattern);
    if (!match || match.index === undefined) throw new Error('Planting group anchor not found.');
    const index = match.index;

    const block = `
  const handleCopySelectedPlacedPlants = useCallback(() => {
    const ids = selectedInstanceIds.length > 0
      ? selectedInstanceIds
      : selectedInstanceId
        ? [selectedInstanceId]
        : [];
    if (ids.length === 0) return false;

    const selected = ids
      .map(id => placedPlants.find(item => item.instanceId === id))
      .filter((item): item is PlacedPlant => Boolean(item));
    if (selected.length === 0) return false;

    copiedPlacedPlantsRef.current = selected.map(item => ({ ...item }));
    pasteGenerationRef.current = 0;
    setCommentaryMessage(selected.length === 1 ? 'Copy, paste, shrub.' : 'Many duplicates are now possible.');
    addTestLog('selection.copied', { count: selected.length, instanceIds: ids });
    return true;
  }, [selectedInstanceIds, selectedInstanceId, placedPlants, addTestLog]);

  const handlePasteCopiedPlacedPlants = useCallback(() => {
    const copied = copiedPlacedPlantsRef.current;
    if (copied.length === 0) return false;

    pasteGenerationRef.current += 1;
    const pixelsPerDesignFoot = pixelsPerFoot || 20;
    const largestDiameterPx = copied.reduce((largest, item) => {
      if (item.itemType === 'rock') return Math.max(largest, (item.rockSizeFt || 2) * pixelsPerDesignFoot);
      const plant = plants.find(candidate => candidate.id === item.plantId);
      const widthFt = item.displayWidthFt || plant?.matureWidthFt || plant?.minimumSpacingFt || 2;
      return Math.max(largest, widthFt * pixelsPerDesignFoot);
    }, 0);
    const offset = Math.max(36, largestDiameterPx + 16) * pasteGenerationRef.current;
    const clones = copied.map(item => ({
      ...item,
      instanceId: generateId(),
      x: item.x + offset,
      y: item.y + offset,
    }));
    const newIds = clones.map(item => item.instanceId);

    setPlacedPlants(prev => [...prev, ...clones]);
    setSelectedInstanceIds(newIds);
    setSelectedInstanceId(newIds[0] || null);
    if (newIds.length > 0) setRightInspectorSection('item');
    setCommentaryMessage(newIds.length === 1 ? 'Repetition is design.' : 'Several plants have entered the situation.');
    addTestLog('selection.pasted', { count: newIds.length, newInstanceIds: newIds, offset });
    return true;
  }, [pixelsPerFoot, plants, addTestLog]);

  useEffect(() => {
    const onClipboardKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      if (!(event.ctrlKey || event.metaKey)) return;

      const key = event.key.toLowerCase();
      if (key === 'c') {
        if (handleCopySelectedPlacedPlants()) event.preventDefault();
      } else if (key === 'v') {
        if (handlePasteCopiedPlacedPlants()) event.preventDefault();
      }
    };

    window.addEventListener('keydown', onClipboardKeyDown);
    return () => window.removeEventListener('keydown', onClipboardKeyDown);
  }, [handleCopySelectedPlacedPlants, handlePasteCopiedPlacedPlants]);

`;

    source = source.slice(0, index) + block + source.slice(index);
  }

  fs.writeFileSync(path, source);
}

updatePlanDetails();
updateApp();
console.log('Fixed maintained-width reset and added Ctrl+C / Ctrl+V for single and marquee selections.');
