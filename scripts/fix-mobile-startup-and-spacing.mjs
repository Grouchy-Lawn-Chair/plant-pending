import fs from 'node:fs';

const appFile = 'src/App.tsx';
const planDetailsFile = 'src/components/PlanDetails.tsx';
const cssFile = 'src/index.css';

function read(path) {
  const raw = fs.readFileSync(path, 'utf8');
  return { newline: raw.includes('\r\n') ? '\r\n' : '\n', text: raw.replace(/\r\n/g, '\n') };
}
function write(path, text, newline) {
  fs.writeFileSync(path, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}

const app = read(appFile);
let appText = app.text;

// Always start with the canvas unobstructed. Do not depend on closing Welcome.
appText = appText.replace(/(const \[leftPanelMode, setLeftPanelMode\][^=]*= useState<[^>]+>\()'library'(\))/,
  "$1'closed'$2");
appText = appText.replace(/(const \[leftPanelMode, setLeftPanelMode\][^=]*= useState\()'library'(\))/,
  "$1'closed'$2");
appText = appText.replace(/(const \[rightInspectorSection, setRightInspectorSection\][^=]*= useState<[^>]+>\()'[^']+'(\))/,
  '$1null$2');
appText = appText.replace(/(const \[rightInspectorSection, setRightInspectorSection\][^=]*= useState\()'[^']+'(\))/,
  '$1null$2');

// Give the File menu stable mobile hooks.
appText = appText.replace(
  '<div ref={fileMenuRef} className="relative mr-auto">',
  '<div ref={fileMenuRef} className="app-file-menu relative mr-auto">',
);
appText = appText.replace(
  '<div className="absolute left-0 top-11 z-[70] w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 py-2 text-sm shadow-2xl">',
  '<div className="app-file-dropdown absolute left-0 top-11 z-[70] w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 py-2 text-sm shadow-2xl">',
);

write(appFile, appText, app.newline);

const details = read(planDetailsFile);
let detailsText = details.text;
// Mark the Current Plan strip so it can be hidden only on small screens.
if (!detailsText.includes('mobile-current-plan-strip')) {
  detailsText = detailsText.replace(
    /(<div className="[^"]*"[^>]*>\s*<div[^>]*>\s*<div[^>]*>Current plan<\/div>)/i,
    match => match.replace('<div className="', '<div className="mobile-current-plan-strip '),
  );
}
write(planDetailsFile, detailsText, details.newline);

const css = read(cssFile);
let cssText = css.text;
const marker = '/* Mobile startup and spacing corrections */';
if (!cssText.includes(marker)) {
  cssText += `

${marker}
@media (max-width: 1023px) {
  /* The canvas is the default mobile view. */
  .mobile-inspector-sheet.w-12 { display: none !important; }
  .mobile-current-plan-strip { display: none !important; }

  /* Keep the original inspector icons. Do not invent replacement symbols. */
  .mobile-tool-rail button svg,
  .mobile-tool-rail button img { flex: 0 0 auto; }

  /* File menu stays inside the phone instead of being clipped by the header. */
  .app-file-menu { position: static !important; }
  .app-file-dropdown {
    position: fixed !important;
    z-index: 100 !important;
    left: 0.75rem !important;
    right: 0.75rem !important;
    top: 4.25rem !important;
    width: auto !important;
    max-height: calc(100dvh - 5rem);
    overflow-y: auto !important;
    border-radius: 1rem !important;
  }
  .app-file-dropdown button,
  .app-file-dropdown div { white-space: normal; }

  /* Canvas setup controls remain one clean, scrollable row. */
  .app-canvas > div > div:first-child {
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    gap: 0.45rem !important;
    padding: 0.45rem 0.6rem !important;
    scrollbar-width: none;
  }
  .app-canvas > div > div:first-child::-webkit-scrollbar { display: none; }
  .app-canvas > div > div:first-child > * { flex: 0 0 auto; }

  /* Plant Library header and search must occupy separate rows. */
  .mobile-left-sheet { overflow: hidden !important; }
  .mobile-left-sheet > div:first-child {
    position: relative !important;
    flex: 0 0 auto !important;
    padding: 0.8rem 0.9rem 0.65rem !important;
  }
  .mobile-left-sheet input[placeholder="Search plants..."] {
    position: relative !important;
    display: block !important;
    width: 100% !important;
    margin-top: 0.15rem !important;
  }
  .mobile-left-sheet > div:nth-child(2) { min-height: 0; }

  /* Welcome uses the full width without crushing the logo and title together. */
  div[class~="fixed"][class~="inset-0"] > div {
    width: min(100%, 30rem) !important;
  }
  div[class~="fixed"][class~="inset-0"] img[alt="Plant Pending"] {
    max-width: 9rem !important;
    height: auto !important;
  }
}

@media (max-width: 520px) {
  .app-header-row { align-items: center !important; }
  .app-header-row > div:last-child { gap: 0.35rem !important; }
  .app-header-row button { padding-left: 0.65rem !important; padding-right: 0.65rem !important; }
  .app-file-dropdown { top: 3.85rem !important; }
}
`;
}
write(cssFile, cssText, css.newline);

console.log('Fixed mobile startup state, File menu clipping, Plant Library overlap, Welcome spacing, and hidden collapsed inspector rail.');
console.log('Original Yard Setup, Areas, and Debug icons are preserved.');
