import fs from 'node:fs';

const file = 'src/index.css';
const raw = fs.readFileSync(file, 'utf8');
const newline = raw.includes('\r\n') ? '\r\n' : '\n';
let text = raw.replace(/\r\n/g, '\n');
const marker = '/* Mobile panel access refinement */';

if (!text.includes(marker)) {
  text += `

${marker}
.mobile-settings-launcher { display: none; }

@media (max-width: 1023px) {
  .mobile-inspector-sheet.w-12 { display: none !important; }

  .mobile-settings-launcher {
    position: fixed;
    z-index: 80;
    right: 0.75rem;
    bottom: calc(4.8rem + env(safe-area-inset-bottom));
    display: inline-flex;
    min-width: 5.25rem;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid #64748b;
    border-radius: 9999px;
    background: #172033;
    padding: 0.65rem 0.85rem;
    color: #f8fafc;
    font-size: 0.75rem;
    font-weight: 800;
    box-shadow: 0 12px 32px rgba(0,0,0,.42);
  }

  .mobile-left-sheet,
  .mobile-inspector-sheet.w-\\[23rem\\] {
    max-height: 58dvh !important;
    height: auto !important;
  }

  .mobile-left-sheet > *,
  .mobile-inspector-sheet.w-\\[23rem\\] > * {
    min-height: 0;
  }

  .mobile-left-sheet { padding-bottom: env(safe-area-inset-bottom); }

  .app-header-row > div:last-child {
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .app-header-row > div:last-child::-webkit-scrollbar { display: none; }
}

@media (max-width: 1023px) and (orientation: landscape) and (max-height: 500px) {
  .app-header { padding: 0.3rem 0.55rem !important; }
  .app-header-row > div:first-child > div:first-child { width: 2.15rem !important; height: 2.15rem !important; }
  .app-header-row h1 { font-size: 0.8rem !important; }
  .mobile-tool-rail {
    height: calc(3.65rem + env(safe-area-inset-bottom)) !important;
    padding-top: 0.35rem !important;
    padding-bottom: calc(0.35rem + env(safe-area-inset-bottom)) !important;
  }
  .mobile-tool-rail button { width: 2.75rem !important; height: 2.75rem !important; min-width: 44px; min-height: 44px; }
  .app-workspace { padding-bottom: calc(3.65rem + env(safe-area-inset-bottom)) !important; }
  .mobile-settings-launcher { bottom: calc(4.05rem + env(safe-area-inset-bottom)); }
  .mobile-left-sheet,
  .mobile-inspector-sheet.w-\\[23rem\\] {
    max-height: 68dvh !important;
  }
}
`;
}

fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
console.log('Added a visible mobile Settings button and reduced how much of the canvas mobile sheets cover.');
