export type HelpSection = {
  title: string;
  body: string;
};

export const WELCOME_STEPS: Array<[string, string]> = [
  ['1. Give it a yard', 'Add a yard image or start blank, then set the scale. Otherwise your three-foot shrub may become a botanical aircraft carrier.'],
  ['2. Draw where plants are allowed to exist', 'Outline beds, slopes, pool planters, hedges, and no-plant areas. Add sun, water, and front or back edges so the app understands which direction is “tall stuff goes over there.”'],
  ['3. Add plants, then make them organize themselves', 'Place plants by hand, build a plant set, or choose a recipe. Use Basic generation for a quick arrangement, or Advanced generation when you need to supervise every shrub like a tiny landscape dictator.'],
  ['4. Tweak it. Save it. Produce evidence.', 'Move plants, adjust maintained widths, try another version, then save, export, or print the plan before the yard changes its mind.'],
];

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Getting started',
    body: 'The basic loop is simple: add a yard image, set scale, draw zones, describe each zone, then place plants manually or generate a layout from a plant set or recipe.',
  },
  {
    title: 'Uploading and positioning a yard image',
    body: 'Use Change image to add a top-down yard image. Position it, adjust opacity if needed, then lock it so the entire property does not wander off while you are placing shrubs.',
  },
  {
    title: 'Setting and changing scale',
    body: 'Set scale by clicking two points with a known real-world distance. Scale controls mature plant circles, spacing, quantities, area measurements, and print estimates.',
  },
  {
    title: 'Drawing, editing, and duplicating zones',
    body: 'Draw areas around beds, slopes, pool planters, hedges, and other planting areas. Select a zone to rename it, move points, duplicate it, change its color, or delete it.',
  },
  {
    title: 'Area purpose and site conditions',
    body: 'Set the area purpose, sun exposure, afternoon sun, water preference, fullness, variety, and layout type. These settings help the generator choose and arrange plants that make sense for the space.',
  },
  {
    title: 'Front and back edges',
    body: 'Mark front edges where shorter plants should gather and back edges where taller plants, hedges, or screening plants belong. More than one front or back edge can be selected when the bed shape needs it.',
  },
  {
    title: 'No-plant areas',
    body: 'Use no-plant areas for patios, fire pits, paths, utilities, and any place where plants should not generate. The layout engine treats those areas as unavailable space.',
  },
  {
    title: 'Choosing plants manually',
    body: 'Open the plant library, search or filter, click a plant card, then click the plan to place it. Plants begin at mature spread. After placement, select a plant and change its maintained width when you intend to keep it smaller through pruning.',
  },
  {
    title: 'Creating plant sets',
    body: 'A plant set is a custom palette you build from the plant library. Add the plants you want, assign the group to a zone, then generate layouts using only that group.',
  },
  {
    title: 'Using the Recipe Engine',
    body: 'Recipes are curated plant combinations with layout guidance. Choose a recipe, adjust its plants and controls, or search the full plant catalog and add another plant to that generation. Added plants can be assigned a maintained width, layer, placement style, grouping, spacing, weight, or exact count before generating.',
  },
  {
    title: 'Recipe substitutions and unavailable plants',
    body: 'When an exact recipe plant is unavailable, the app may use a close catalog match or substitute with a similar role, size, form, and growing requirement. Review the matched plant list before generating.',
  },
  {
    title: 'Fullness, variety, and quantities',
    body: 'Fullness is a target for how much of the area should be occupied. Even at 100%, the generator will not stack plant circles. When the requested plants cannot fit safely at their mature or maintained widths, it places fewer plants and reports the shortfall.',
  },
  {
    title: 'Seed and layout variations',
    body: 'The seed changes the generated arrangement while keeping the same recipe and settings. Use different seeds to explore genuinely different layouts without rebuilding the area.',
  },
  {
    title: 'Generating an area',
    body: 'Select an area, choose its plant set or recipe, set layout controls, then generate. The physics layout engine uses plant size, area boundaries, exclusions, edges, spacing, and recipe behavior to arrange the plants.',
  },
  {
    title: 'Replacing existing zone plants',
    body: 'When regenerating, choose whether the new layout should replace plants already assigned to that area or preserve them. Use replace when testing variations and preserve when adding around established placements.',
  },
  {
    title: 'Mature width and maintained width',
    body: 'Mature width is the catalog estimate for an unrestrained plant. Maintained width is the size you plan to hold through pruning, and it controls the circle shown on the plan. Select a placed plant and enter the maintained width in feet. For example, a Red Tip Photinia that can mature to 15 feet wide can be shown as 2 feet wide when planned as a hedge kept at 24 inches.',
  },
  {
    title: 'Mature size, spacing, and overlap',
    body: 'Plant circles use the selected maintained width when one is set, otherwise they use mature spread. Generated plants never occupy the same space. Tight spacing means circles may touch, not overlap. If the requested count or fullness cannot fit, the generator prunes the conflicting plants instead of inventing extra yard.',
  },
  {
    title: 'Moving, rotating, resizing, duplicating, and deleting items',
    body: 'Select an item to edit it. Drag to move, set a maintained width in the Selection panel, adjust rotation and color, duplicate repeated elements, or delete the plant that has failed the interview.',
  },
  {
    title: 'Clumping and merged shrub display',
    body: 'Visual clumping can make nearby shrubs read as one connected mass. This changes the drawing style only. Recipe generation still keeps every plant circle separate and never uses clumping as permission to stack plants.',
  },
  {
    title: 'Plant colors, labels, images, and symbols',
    body: 'Use the canvas and selected-item controls to change display mode, symbol color, labels, opacity, rotation, maintained width, and notes. Icons are planning symbols, not promises that the plant will behave.',
  },
  {
    title: 'Adding rocks and other objects',
    body: 'Use the rock tool from the left rail and click the plan. Rocks can be moved, resized, duplicated, and included in printed layouts. They remain extremely committed to mature size.',
  },
  {
    title: 'Layers and area visibility',
    body: 'Use the Yard setup panel to control labels, icon opacity, merge behavior, display mode, zoom, and area visibility. Hide area shapes when you want a cleaner presentation without deleting the areas.',
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
    title: 'Printing and area sheets',
    body: 'Print creates a plan set with a master layout, individual area sheets, plant schedules, quantities, costs, and Plant Pending branding. Content flows across pages when a zone needs more room.',
  },
  {
    title: 'Keyboard shortcuts',
    body: 'Escape cancels placement or drawing. Delete removes selected items. Backspace removes the last area point. Shift-drag selects multiple items. Ctrl or Cmd plus, minus, and 0 control zoom.',
  },
  {
    title: 'Troubleshooting generated layouts',
    body: 'If a layout places fewer plants than requested, the area ran out of valid non-overlapping space. Reduce fullness or exact counts, use smaller maintained widths, or try another seed. Also check scale, exclusions, rocks, and front or back edges before blaming the shrubs.',
  },
  {
    title: 'About plant data and mature sizes',
    body: 'Plant Pending uses the Green Acres catalog and source-backed planning fields where available. Mature sizes, prices, availability, substitutions, and growing behavior are planning guides. Maintained width is a design choice, not a claim that the plant naturally stays that size.',
  },
];
