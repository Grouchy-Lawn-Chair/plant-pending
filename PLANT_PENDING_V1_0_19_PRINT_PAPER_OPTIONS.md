# Plant Pending v1.0.19 – Print paper options and multi-page fix

Changed:
- Print view now defaults to Letter landscape.
- Added a Paper selector in the print toolbar:
  - Letter
  - 11×17
- Print CSS now uses the selected paper size.
- Fixed print layout CSS so all print-page sections are visible to the browser print engine, instead of only the first sheet.
- 11×17 remains available for large format printing, but Letter is the default.

Build check:
- npm run build passed.
