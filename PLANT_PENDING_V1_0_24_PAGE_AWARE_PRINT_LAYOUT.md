# Plant Pending v1.0.24 – Page-aware print layout

This pass rebuilds the print view around page-sized content blocks instead of trying to let oversized content spill.

Changed:
- Page 1 is only the master plan and zone summary.
- Plant legend flows to its own page(s), chunked by paper size.
- Zone detail pages show map + a limited plant-list chunk only.
- If a zone plant list is too long, it continues on separate zone list pages.
- Zone photos flow to their own photo pages, chunked by paper size.
- Shopping schedule rows are chunked into multiple pages.
- Cost summary is its own page.
- Footer is compact and anchored to the page bottom.
- Minimum print font size is kept at 10pt for body/table content.
- Letter and 11×17 use different page capacities.

Build check:
- npm run build passed.
