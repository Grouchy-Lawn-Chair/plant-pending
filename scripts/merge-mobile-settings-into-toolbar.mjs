import fs from 'node:fs';

const file = 'src/index.css';
const raw = fs.readFileSync(file, 'utf8');
const newline = raw.includes('\r\n') ? '\r\n' : '\n';
let text = raw.replace(/\r\n/g, '\n');
const marker = '/* Merge mobile settings into toolbar */';

if (!text.includes(marker)) {
  text += `

${marker}
@media (max-width: 1023px) {
  .mobile-tool-rail .mobile-settings-launcher {
    position: static !important;
    inset: auto !important;
    z-index: auto !important;
    display: inline-flex !important;
    width: 3rem !important;
    min-width: 48px !important;
    height: 3rem !important;
    min-height: 48px !important;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    border: 0 !important;
    border-radius: 0.75rem !important;
    background: transparent !important;
    padding: 0.2rem !important;
    box-shadow: none !important;
    color: #cbd5e1;
    font-size: 0.6rem !important;
    line-height: 1;
  }

  .mobile-tool-rail .mobile-settings-launcher:hover,
  .mobile-tool-rail .mobile-settings-launcher:focus-visible,
  .mobile-tool-rail .mobile-settings-launcher.is-open {
    background: #263244 !important;
    color: #ffffff;
  }

  .mobile-tool-rail .mobile-tool-label {
    display: block;
    max-width: 3rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-tool-rail-inner {
    overflow-x: auto;
    overflow-y: hidden;
    justify-content: flex-start !important;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-tool-rail-inner::-webkit-scrollbar { display: none; }
}

@media (max-width: 1023px) and (orientation: landscape) and (max-height: 500px) {
  .mobile-tool-rail .mobile-settings-launcher {
    width: 2.75rem !important;
    min-width: 44px !important;
    height: 2.75rem !important;
    min-height: 44px !important;
  }
  .mobile-tool-rail .mobile-tool-label { display: none; }
}
`;
}

fs.writeFileSync(file, newline === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
console.log('Merged Settings into the mobile bottom toolbar and removed the floating pill.');
