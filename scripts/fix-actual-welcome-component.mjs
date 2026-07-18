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
  return { raw, text: raw.replace(/\r\n/g, '\n'), newline: raw.includes('\r\n') ? '\r\n' : '\n' };
}

function write(file, text, newline) {
  fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const files = walk('src');
let welcomeFile = null;
let welcome = null;

for (const file of files) {
  const data = read(file);
  const text = data.text;
  const hasWelcome = /Welcome[\s\S]{0,400}?Plant[\s\S]{0,200}?Pending/i.test(text);
  const hasKicker = /VERSION[\s\S]{0,120}?2\.0[\s\S]{0,220}?YARD[\s\S]{0,120}?PANIC[\s\S]{0,120}?REDUCER/i.test(text);
  if (hasWelcome || hasKicker) {
    welcomeFile = file;
    welcome = data;
    break;
  }
}

if (!welcomeFile || !welcome) {
  throw new Error('Could not find the actual welcome component in src. No files written.');
}

let text = welcome.text;

// Remove the smallest JSX element that contains the green kicker.
text = text.replace(
  /<([A-Za-z][\w.]*)\b[^>]*>[\s\S]{0,500}?VERSION[\s\S]{0,120}?2\.0[\s\S]{0,500}?YARD[\s\S]{0,120}?PANIC[\s\S]{0,120}?REDUCER[\s\S]{0,120}?<\/\1>/gi,
  '',
);

// Fallback for split text nodes.
text = text
  .replace(/VERSION\s*2\.0/gi, '')
  .replace(/YARD\s*PANIC\s*REDUCER/gi, '');

// Add one direct class to the welcome content wrapper.
if (!text.includes('mobile-welcome-layout')) {
  const heading = text.search(/Welcome[\s\S]{0,250}?Plant[\s\S]{0,150}?Pending/i);
  if (heading >= 0) {
    const before = text.slice(Math.max(0, heading - 2500), heading);
    const tags = [...before.matchAll(/<(div|section)\b[^>]*>/g)];
    if (tags.length) {
      const match = tags[tags.length - 1];
      const absolute = Math.max(0, heading - 2500) + match.index;
      const tag = match[0];
      const updated = /className=/.test(tag)
        ? tag.replace(/className="([^"]*)"/, 'className="$1 mobile-welcome-layout"')
        : tag.replace(/>$/, ' className="mobile-welcome-layout">');
      text = text.slice(0, absolute) + updated + text.slice(absolute + tag.length);
    }
  }
}

write(welcomeFile, text, welcome.newline);

const cssFile = 'src/index.css';
const cssData = read(cssFile);
let css = cssData.text;
const marker = '/* Actual welcome component mobile layout */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (max-width: 767px) {\n  .mobile-welcome-layout {\n    display: flex !important;\n    flex-direction: column !important;\n    align-items: center !important;\n    justify-content: flex-start !important;\n    grid-template-columns: 1fr !important;\n    gap: .75rem !important;\n    width: 100% !important;\n  }\n\n  .mobile-welcome-layout > * {\n    width: 100% !important;\n    max-width: 100% !important;\n  }\n\n  .mobile-welcome-layout img {\n    display: block !important;\n    width: min(9rem, 42vw) !important;\n    height: auto !important;\n    margin: 0 auto .5rem !important;\n    object-fit: contain !important;\n  }\n\n  .mobile-welcome-layout h1,\n  .mobile-welcome-layout h2,\n  .mobile-welcome-layout p {\n    text-align: center !important;\n    margin-left: auto !important;\n    margin-right: auto !important;\n  }\n}\n`;
  write(cssFile, css, cssData.newline);
}

console.log(`Updated actual welcome component: ${welcomeFile}`);
