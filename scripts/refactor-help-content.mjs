import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = "import { PrintView } from './components/PrintView';\n";
const componentImports = "import { PrintView } from './components/PrintView';\nimport { WelcomeGuide } from './components/WelcomeGuide';\nimport { HelpCenter } from './components/HelpCenter';\n";
if (!source.includes("import { WelcomeGuide } from './components/WelcomeGuide';")) {
  if (!source.includes(importAnchor)) throw new Error('Import anchor not found.');
  source = source.replace(importAnchor, componentImports);
}

source = source.replace(/\nconst HELP_SECTIONS = \[[\s\S]*?\n\];\n\nconst SCORE_TITLES = /, '\nconst SCORE_TITLES = ');

source = source.replace(/\n  const visibleHelpSections = HELP_SECTIONS\.filter\([\s\S]*?\n  \}\);\n/, '\n');

const welcomeStart = source.indexOf('      {showWelcomeGuide && (');
const helpStart = source.indexOf('      {showHelpCenter && (');
if (welcomeStart === -1 || helpStart === -1 || helpStart <= welcomeStart) {
  throw new Error('Welcome or help modal block not found.');
}

const welcomeReplacement = `      <WelcomeGuide\n        open={showWelcomeGuide}\n        showOnStartup={showWelcomeOnStartup}\n        onShowOnStartupChange={(checked) => {\n          setShowWelcomeOnStartup(checked);\n          localStorage.setItem(WELCOME_SETTING_KEY, checked ? 'true' : 'false');\n        }}\n        onClose={() => setShowWelcomeGuide(false)}\n        onOpenHelp={() => {\n          setShowWelcomeGuide(false);\n          setShowHelpCenter(true);\n        }}\n      />\n\n`;
source = source.slice(0, welcomeStart) + welcomeReplacement + source.slice(helpStart);

const refreshedHelpStart = source.indexOf('      {showHelpCenter && (');
const aboutStart = source.indexOf('      {/* About modal */}', refreshedHelpStart);
if (refreshedHelpStart === -1 || aboutStart === -1) {
  throw new Error('Help modal or About marker not found.');
}

const helpReplacement = `      <HelpCenter\n        open={showHelpCenter}\n        search={helpSearch}\n        onSearchChange={setHelpSearch}\n        onClose={() => setShowHelpCenter(false)}\n      />\n\n`;
source = source.slice(0, refreshedHelpStart) + helpReplacement + source.slice(aboutStart);

fs.writeFileSync(path, source);
console.log('Moved welcome and help UI out of App.tsx and refreshed Version 2.0 help content.');
