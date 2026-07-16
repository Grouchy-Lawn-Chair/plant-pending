import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes("import { WelcomeGuide } from './components/WelcomeGuide';")) {
  const printViewImport = /import \{ PrintView \} from '\.\/components\/PrintView';\r?\n/;
  if (!printViewImport.test(source)) throw new Error('PrintView import not found.');
  source = source.replace(
    printViewImport,
    "import { PrintView } from './components/PrintView';\nimport { WelcomeGuide } from './components/WelcomeGuide';\nimport { HelpCenter } from './components/HelpCenter';\n",
  );
}

source = source.replace(
  /\r?\nconst HELP_SECTIONS = \[[\s\S]*?\r?\n\];\r?\n\r?\nconst SCORE_TITLES = /,
  '\nconst SCORE_TITLES = ',
);

source = source.replace(
  /\r?\n  const visibleHelpSections = HELP_SECTIONS\.filter\([\s\S]*?\r?\n  \}\);\r?\n/,
  '\n',
);

if (!source.includes('      <WelcomeGuide')) {
  const welcomeStart = source.indexOf('      {showWelcomeGuide && (');
  const helpStart = source.indexOf('      {showHelpCenter && (');
  if (welcomeStart === -1 || helpStart === -1 || helpStart <= welcomeStart) {
    throw new Error('Welcome or help modal block not found.');
  }

  const welcomeReplacement = `      <WelcomeGuide
        open={showWelcomeGuide}
        showOnStartup={showWelcomeOnStartup}
        onShowOnStartupChange={(checked) => {
          setShowWelcomeOnStartup(checked);
          localStorage.setItem(WELCOME_SETTING_KEY, checked ? 'true' : 'false');
        }}
        onClose={() => setShowWelcomeGuide(false)}
        onOpenHelp={() => {
          setShowWelcomeGuide(false);
          setShowHelpCenter(true);
        }}
      />

`;

  source = source.slice(0, welcomeStart) + welcomeReplacement + source.slice(helpStart);
}

if (!source.includes('      <HelpCenter')) {
  const helpStart = source.indexOf('      {showHelpCenter && (');
  const aboutStart = source.indexOf('      {/* About modal */}', helpStart);
  if (helpStart === -1 || aboutStart === -1) {
    throw new Error('Help modal or About marker not found.');
  }

  const helpReplacement = `      <HelpCenter
        open={showHelpCenter}
        search={helpSearch}
        onSearchChange={setHelpSearch}
        onClose={() => setShowHelpCenter(false)}
      />

`;

  source = source.slice(0, helpStart) + helpReplacement + source.slice(aboutStart);
}

fs.writeFileSync(path, source);
console.log('Moved welcome and help UI out of App.tsx and refreshed Version 2.0 help content.');

// This file is intentionally kept as a one-time, auditable migration helper.
