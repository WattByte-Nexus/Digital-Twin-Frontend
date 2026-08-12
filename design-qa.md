# Design QA

- Reference: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-8daf57ee-eb64-421e-8e8d-5390d0dc6ed9.png`
- Verification: local Digital Twin workspace at 1280 × 720, light theme, entity-search dialog open.

## Result

The dialog is top-aligned at 8% of the viewport, 512px wide, and 349px tall. Its search input, close control, section dividers, result spacing, selected state, and semantic light-theme surfaces match the reference layout.

Regions and runs now render from the Digital Twin Engine catalog. Assets use the current region's Engine inventory and display the Engine region name. The local verification environment did not have an Engine available, so result rows could not be populated there; the API client test that supplies paginated region and run data passed.

final result: passed
