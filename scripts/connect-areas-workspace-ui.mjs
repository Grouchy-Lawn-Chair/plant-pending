import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');
const newline = source.includes('\r\n') ? '\r\n' : '\n';
const normalized = source.replace(/\r\n/g, '\n');

const oldBlock = `      if (workspace === 'plants') {
        setLeftPanelMode(current => current === 'closed' ? 'library' : current);
        if (selectedInstanceId) setRightInspectorSection('item');
      }`;

const newBlock = `      if (workspace === 'plants') {
        setLeftPanelMode(current => current === 'closed' ? 'library' : current);
        if (selectedInstanceId) setRightInspectorSection('item');
      } else if (workspace === 'areas') {
        setRightInspectorSection('zones');
      }`;

if (normalized.includes(newBlock)) {
  console.log('Areas workspace is already connected to the existing zone inspector.');
  process.exit(0);
}

if (!normalized.includes(oldBlock)) {
  throw new Error('Workspace change handler anchor not found. Confirm the Plants workspace phase and repair were applied first.');
}

const updated = normalized.replace(oldBlock, newBlock);
fs.writeFileSync(path, newline === '\r\n' ? updated.replace(/\n/g, '\r\n') : updated);
console.log('Connected the Areas workspace to the existing zone inspector.');
