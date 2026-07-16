export type HelpSection = {
  title: string;
  body: string;
};

export const WELCOME_STEPS: Array<[string, string]> = [
  ['1. Add your yard', 'Upload a top-down image, load the example plan, or begin with a blank canvas.'],
  ['2. Set the scale', 'Mark a known distance so mature plant sizes, spacing, quantities, and print measurements are accurate.'],
  ['3. Draw planting zones', 'Outline beds, slopes, pool planters, hedge strips, and other planting areas. Add exclusion zones for patios, fire pits, and places plants should fear to tread.'],
  ['4. Describe the zone', 'Set sun, afternoon exposure, water needs, and zone purpose. Mark front and back edges when plant height or layout direction matters.'],
  ['5. Choose plants or a recipe', 'Select plants yourself, create a planting group, or choose a professionally sourced recipe from the Recipe Engine.'],
  ['6. Generate and adjust', 'Set fullness, variety, and seed, then generate a layout. Try another seed, move plants manually, or regenerate until the shrubs stop arguing.'],
  ['7. Save, export, or print', 'Save plans in this browser, export an editable JSON file, or create a printable plan set with zone sheets, quantities, and costs.'],
];

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Getting started',
    body: 'The basic loop is simple: add a yard image, set scale, draw zones, describe each zone, then place plants manually or generate a layout from a planting group or recipe.',
  },
  {
    title: 'Uploading and positioning a yard image',
    body: 'Use Change image to add a top-down yard image. Position it, adjust opacity if needed, then lock it so the entire property does not wander off while you are placing shrubs.',
  },
  {
    title: 'Setting and changing scale',
    body: 'Set scale by clicking two points with a known real-world distance. Scale controls mature plant circles, spacing, quantities, zone measurements, and print estimates.',
  },
  {
    title: 'Drawing, editing, and duplicating zones',
    body: 'Draw zones around beds, slopes, pool planters, hedges, and other planting areas. Select a zone to rename it, move points, duplicate it, change its color, or delete it.',
  },
  {
    title: 'Zone purpose and site conditions',
    body: 'Set the zone purpose, sun exposure, afternoon sun, water preference, fullness, variety, and layout type. These settings help the generator choose and arrange plants that make sense for the space.',
  },
  {
    title: 'Front and back edges',
    body: 'Mark front edges where shorter plants should gather and back edges where taller plants, hedges, or screening plants belong. More than one front or back edge can be selected when the bed shape needs it.',
  },
  {
    title: 'Exclusion zones',
    body: 'Use exclusion zones for patios, fire pits, paths, utilities, and any place where plants should not generate. The layout engine treats those areas as unavailable space.',
  },
  {
    title: 'Choosing plants manually',
    body: 'Open the plant library, search or filter, click a plant card, then click the plan to place it. Plants appear at mature spread so you can see what future you is actually signing up for.',
  },
  {
    title: 'Creating planting groups',
    body: 'A planting group is a custom palette you build from the plant library. Add the plants you want, assign the group to a zone, then generate layouts using only that group.',
  },
  {
    title: 'Using the Recipe Engine',
    body: 'Recipes are curated plant combinations with layout guidance. Choose a recipe in the Recipe Engine, review the matched Green Acres plants, adjust counts or controls, then generate the arrangement inside the selected zone.',
  },
  {
    title: 'Recipe substitutions and unavailable plants',
    body: 'When an exact recipe plant is unavailable, the app may use a close catalog match or substitute with a similar role, size, form, and growing requirement. Review the matched plant list before generating.',
  },
  {
    title: 'Fullness, variety, and quantities',
    body: 'Fullness controls how much of the zone is occupied. Variety controls whether the layout uses a tighter repeated palette or more plant types. Mature plant size still limits how many plants can safely fit.',
  },
  {
    title: 'Seed and layout variations',
    body: 'The seed changes the generated arrangement while keeping the same recipe and settings. Use different seeds to explore genuinely different layouts without rebuilding the zone.',
  },
  {
    title: 'Generating a zone',
    body: 'Select a zone, choose its planting group or recipe, set layout controls, then generate. The physics layout engine uses plant size, zone boundaries, exclusions, edges, spacing, and recipe behavior to arrange the plants.',
  },
  {
    title: 'Replacing existing zone plants',
    body: 'When regenerating, choose whether the new layout should replace plants already assigned to that zone or preserve them. Use replace when testing variations and preserve when adding around established placements.',
  },
  {
    title: 'Mature size, spacing, and overlap',
    body: 'Plant circles represent mature spread. Normal plants should not generate on top of one another. If the requested count cannot fit, the generator should place fewer plants instead of inventing extra yard.',
  },
  {
    title: 'Moving, rotating, resizing, duplicating, and deleting items',
    body: 'Select an item to edit it. Drag to move, use the inspector for rotation and size, duplicate repeated elements, or delete the plant that has failed the interview.',
  },
  {
    title: 'Clumping and merged shrub display',
    body: 'Visual clumping can make overlapping shrubs read as one connected mass. This changes the drawing style, not the real mature spacing rule. Use it for hedge or groundcover effects, not as permission to stack plants.',
  },
  {
    title: 'Plant colors, labels, images, and symbols',
    body: 'Use the canvas and selected-item controls to change display mode, symbol color, labels, opacity, rotation, and notes. Icons are planning symbols, not promises that the plant will behave.',
  },
  {
    title: 'Adding rocks and other objects',
    body: 'Use the rock tool from the left rail and click the plan. Rocks can be moved, resized, duplicated, and included in printed layouts. They remain extremely committed to mature size.',
  },
  {
    title: 'Layers and zone visibility',
    body: 'Use the Canvas panel to control labels, icon opacity, merge behavior, display mode, zoom, and zone visibility. Hide zone shapes when you want a cleaner presentation without deleting the zones.',
  },
  {
    title: 'Costs and Green Acres availability',
    body: 'The total in the header estimates placed plant cost using available Green Acres catalog prices. Catalog matches and prices are planning references and may not reflect current store inventory.',
  },
  {
    title: 'Saving, importing, and exporting plans',
    body: 'Use File to save, open, import, export, or start fresh. Saved plans live in this browser on this computer. Export JSON creates a portable editable plan file you can keep or share.',
  },
  {
    title: 'Printing and zone sheets',
    body: 'Print creates a plan set with a master layout, individual zone sheets, plant schedules, quantities, costs, and Plant Pending branding. Content flows across pages when a zone needs more room.',
  },
  {
    title: 'Keyboard shortcuts',
    body: 'Escape cancels placement or drawing. Delete removes selected items. Backspace removes the last zone point. Shift-drag selects multiple items. Ctrl or Cmd plus, minus, and 0 control zoom.',
  },
  {
    title: 'Troubleshooting generated layouts',
    body: 'If a layout is too sparse, raise fullness or use spreading plants. If it is crowded, reduce fullness, reduce counts, or use smaller plants. Try another seed for a different arrangement. Check zone scale, exclusions, and front or back edges before blaming the shrubs.',
  },
  {
    title: 'About plant data and mature sizes',
    body: 'Plant Pending uses the Green Acres catalog and source-backed planning fields where available. Mature sizes, prices, availability, substitutions, and growing behavior are planning guides. Actual plants may have irrigation, pruning, climate, and ambition.',
  },
];
