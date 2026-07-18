import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx|jsx)$/.test(entry.name) ? [full] : [];
  });
}

function read(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

function score(text) {
  const tokens = ['VERSION', 'PANIC', 'REDUCER', 'Welcome', 'Pending'];
  return tokens.reduce((total, token) => total + (text.toLowerCase().includes(token.toLowerCase()) ? 1 : 0), 0);
}

function openingTagsBefore(text, index) {
  const stack = [];
  const tagPattern = /<\/?([A-Za-z][\w.]*)\b[^>]*>/g;
  let match;
  while ((match = tagPattern.exec(text)) && match.index < index) {
    const full = match[0];
    const name = match[1];
    const selfClosing = /\/>$/.test(full);
    if (selfClosing) continue;
    if (full.startsWith('</')) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === name) {
          stack.splice(i, 1);
          break;
        }
      }
    } else {
      stack.push({ name, start: match.index, openEnd: tagPattern.lastIndex, full });
    }
  }
  return stack;
}

function closingTagEnd(text, opening) {
  const pattern = new RegExp(`<\\/?${opening.name}\\b[^>]*>`, 'g');
  pattern.lastIndex = opening.start;
  let depth = 0;
  let match;
  while ((match = pattern.exec(text))) {
    const full = match[0];
    if (/\/>$/.test(full)) continue;
    if (full.startsWith('</')) depth -= 1;
    else depth += 1;
    if (depth === 0) return pattern.lastIndex;
  }
  return -1;
}

function smallestElementContaining(text, start, end) {
  const stack = openingTagsBefore(text, start);
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const closeEnd = closingTagEnd(text, stack[i]);
    if (closeEnd > end) return { ...stack[i], closeEnd };
  }
  return null;
}

const files = walk('src');
const candidates = files
  .map(file => ({ file, data: read(file) }))
  .map(item => ({ ...item, score: score(item.data.text) }))
  .filter(item => item.score >= 3)
  .sort((a, b) => b.score - a.score);

if (!candidates.length) {
  throw new Error('Could not find a source file containing the welcome text. No files written.');
}

const chosen = candidates[0];
let text = chosen.data.text;

const versionIndex = text.search(/VERSION/i);
const reducerMatch = /REDUCER/i.exec(text.slice(Math.max(0, versionIndex)));
if (versionIndex >= 0 && reducerMatch) {
  const reducerEnd = versionIndex + reducerMatch.index + reducerMatch[0].length;
  const kickerElement = smallestElementContaining(text, versionIndex, reducerEnd);
  if (kickerElement) {
    text = text.slice(0, kickerElement.start) + text.slice(kickerElement.closeEnd);
  } else {
    text = text
      .replace(/VERSION\s*2\.0/gi, '')
      .replace(/YARD\s*PANIC\s*REDUCER/gi, '');
  }
}

if (!text.includes('mobile-welcome-layout')) {
  const welcomeIndex = text.search(/Welcome/i);
  const pendingAfter = /Pending/i.exec(text.slice(Math.max(0, welcomeIndex)));
  if (welcomeIndex >= 0 && pendingAfter) {
    const headingEnd = welcomeIndex + pendingAfter.index + pendingAfter[0].length;
    const headingElement = smallestElementContaining(text, welcomeIndex, headingEnd);
    if (headingElement) {
      const ancestors = openingTagsBefore(text, headingElement.start);
      const wrapper = [...ancestors].reverse().find(item => /\b(grid|flex)\b/.test(item.full)) || ancestors.at(-1);
      if (wrapper) {
        const updated = /className="([^"]*)"/.test(wrapper.full)
          ? wrapper.full.replace(/className="([^"]*)"/, 'className="$1 mobile-welcome-layout"')
          : wrapper.full.replace(/>$/, ' className="mobile-welcome-layout">');
        text = text.slice(0, wrapper.start) + updated + text.slice(wrapper.openEnd);
      }
    }
  }
}

write(chosen.file, text, chosen.data.newline);

const cssFile = 'src/index.css';
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Actual welcome component mobile layout v2 */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 767px) {\n  .mobile-welcome-layout {\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: center !important;\n    justify-content: flex-start !important;\n    grid-template-columns: 1fr !important;\n    gap: .75rem !important;\n    width: 100% !important;\n  }\n\n  .mobile-welcome-layout > * {\n    width: 100% !important;\n    max-width: 100% !important;\n    min-width: 0 !important;\n  }\n\n  .mobile-welcome-layout img {\n    display: block !important;\n    width: min(9rem, 42vw) !important;\n    height: auto !important;\n    margin: 0 auto .5rem !important;\n    object-fit: contain !important;\n  }\n\n  .mobile-welcome-layout h1,\n  .mobile-welcome-layout h2,\n  .mobile-welcome-layout p {\n    text-align: center !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n  }\n}\n`;
  write(cssFile, css, cssData.newline);
}

console.log(`Updated actual welcome source: ${chosen.file}`);
console.log(`Candidate score: ${chosen.score}/5`);
