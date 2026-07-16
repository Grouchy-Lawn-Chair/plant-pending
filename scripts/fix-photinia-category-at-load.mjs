import fs from 'node:fs';

const path = 'src/utils/csvParser.ts';
let source = fs.readFileSync(path, 'utf8');

const helper = `
function normalizePlantCategory(
  category: string,
  commonName: string,
  botanicalName: string,
  greenAcresProductName: string,
  greenAcresBotanicalName: string,
): string {
  const identity = \`${'${commonName} ${botanicalName} ${greenAcresProductName} ${greenAcresBotanicalName}'}\`.toLowerCase();
  const isRedTipPhotinia =
    identity.includes('red tip photinia') ||
    identity.includes('red-tip photinia') ||
    (identity.includes('photinia') && identity.includes('fraseri'));

  return isRedTipPhotinia ? 'Shrub' : category;
}
`;

if (!source.includes('function normalizePlantCategory(')) {
  const anchor = 'export async function loadPlantsFromCSV';
  const index = source.indexOf(anchor);
  if (index === -1) throw new Error('Could not find loadPlantsFromCSV.');
  source = source.slice(0, index) + helper + '\n' + source.slice(index);
}

const oldCategory = "        category: getValue('Category'),";
const newCategory = `        category: normalizePlantCategory(
          getValue('Category'),
          commonName,
          botanicalName,
          decodeHtmlEntities(getValue('Green_Acres_Product_Name')),
          decodeHtmlEntities(getValue('Green_Acres_Botanical_Name')),
        ),`;

if (source.includes(oldCategory)) {
  source = source.replace(oldCategory, newCategory);
} else if (!source.includes('category: normalizePlantCategory(')) {
  throw new Error('Could not find the plant category assignment.');
}

fs.writeFileSync(path, source);
console.log('Red Tip Photinia now loads as Shrub everywhere in the app.');
