# Filter toolbar design QA

## Comparison target

- Source visual truth: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-853e2d9b-3dff-47b8-beb6-ac3655b7d4ff.png`
- Light scenario implementation: `/Users/luke/Documents/Digital_Twin_Frontend/scenarios-filters-implementation.png`
- Light run implementation: `/Users/luke/Documents/Digital_Twin_Frontend/runs-filters-implementation.png`
- Scenario filter popover: `/Users/luke/Documents/Digital_Twin_Frontend/scenarios-filters-popover.png`
- Run filter popover: `/Users/luke/Documents/Digital_Twin_Frontend/runs-filters-popover.png`
- Dark scenario implementation: `/Users/luke/Documents/Digital_Twin_Frontend/scenarios-filters-dark.png`
- Focused comparison: `/Users/luke/Documents/Digital_Twin_Frontend/filter-reference-comparison.png`

## Capture details

- Viewport: 1280 × 720 CSS px.
- Browser-reported device pixel ratio: 2.
- Browser screenshot output: 1280 × 720 px, already normalized to the CSS viewport by the in-app browser capture API.
- Source visual: 734 × 138 px at 144 dpi.
- Focused implementation crop: 300 × 48 px, enlarged to 600 × 96 px for the stacked visual comparison. The enlargement changes only comparison scale, not layout proportions.
- State: Scenarios and Runs list views, filters closed and open; Scenarios additionally checked in dark mode.

## Full-view comparison evidence

The light scenario and run captures show the controls in their actual page hierarchy. Search, location/region, and Filters sit on one compact row beneath the page header. The visual hierarchy is consistent across both pages, the toolbar no longer competes with the table, and the controls wrap without clipping.

The open-popover captures confirm that hidden filter options use the active page theme, shared glass-overlay surface, trigger-aligned placement, readable labels, semantic focus rings, and compact option density.

## Focused comparison evidence

`filter-reference-comparison.png` stacks the supplied reference above the implemented location and Filters controls. The implementation preserves the reference's icon-leading select, neutral outlined surfaces, chevron placement, adjacent Filters action, and restrained spacing. It intentionally uses the product's denser 32 px control height, smaller radius, Inter typography, semantic borders, and existing icon system rather than copying the larger screenshot dimensions.

## Required fidelity surfaces

- Fonts and typography: Inter remains consistent with the application. Filter labels use a compact 12 px UI weight with readable spacing and no wrapping.
- Spacing and layout rhythm: 32 px controls, 8 px gaps, 12 px toolbar padding, and 28 px active chips form a consistent dense rhythm. No overflow or clipped persistent controls was observed at 1280 × 720.
- Colors and visual tokens: all new styling uses semantic background, border, muted, accent, foreground, ring, and shared glass-surface tokens. Light and dark mode both retain contrast and visible focus.
- Image quality and asset fidelity: the source contains only standard UI icons; implementation uses the existing icon library and no replacement raster or custom-drawn assets.
- Copy and content: page-specific terminology is preserved (`All locations` for Scenarios and `All regions` for Runs). Filters are named and counted consistently.

## Interaction and accessibility checks

- Scenario status selection changed the table from 5 rows to 1, displayed a removable `Status: Draft` chip, incremented the Filters count, and restored all 5 rows after removal.
- Run status selection displayed a removable `Status: Running` chip and incremented the Filters count; removal cleared the state.
- Search controls have explicit accessible names and a keyboard-accessible clear action when populated.
- Filter triggers, status choices, select controls, and removal chips are keyboard-operable shadcn/Radix controls with visible focus states.
- Portalled select and popover surfaces explicitly receive the active theme and shared glass-overlay treatment.
- Console review found no filter-toolbar errors. Existing map imagery and unavailable local Digital Twin API requests produced unrelated warnings/errors.

## Findings

No actionable P0, P1, or P2 mismatches remain. The implementation is deliberately denser than the supplied directional screenshot so it matches the surrounding product and Linear-like compactness.

## Comparison history

- Pass 1: no P0/P1/P2 visual or interaction issues were found in the light Scenarios view, light Runs view, open popovers, focused reference comparison, or dark Scenarios view. No design-QA fix iteration was required.

## Follow-up polish

No P3 follow-up is required for this scope.

final result: passed

---

# Digital Twin toolbar and sidebar divider design QA

## Comparison target

- Initial alignment reference: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-99fa3dcd-44df-4ccb-a09b-6f2510c0ee85.png`
- Expanded and collapsed height references: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-a8ac023b-223a-459f-8464-d9fb9817ef95.png` and `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-f53907aa-9ddd-4722-be0e-f7cc3646ff17.png`
- Divider-weight reference: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-10c1aa8c-aad0-44b7-9c56-1941a6bd009a.png`
- Browser-rendered expanded implementation: `/private/tmp/digital-twin-grid-expanded-final.png`
- Browser-rendered collapsed implementation: `/private/tmp/digital-twin-grid-collapsed-final.png`
- Focused stacked comparison: `/private/tmp/digital-twin-divider-comparison.png`

## Capture details

- Viewport: 1280 × 720 CSS px in the Codex in-app browser.
- Browser-reported device pixel ratio: 2.
- Browser screenshot output: 1280 × 720 px, normalized to the CSS viewport by the in-app browser capture API.
- Focused source and implementation regions: 579 × 172 px each, stacked without scaling.
- State: light theme with the sidebar expanded and collapsed; divider tokens were also checked in dark mode.

## Full-view comparison evidence

The final expanded and collapsed captures keep the sidebar header and map toolbar divider at y=112. The sidebar header remains 112 px high in both states, the application header remains 64 px, and the map toolbar remains 48 px. The sidebar edge, sidebar header divider, application-header divider, and toolbar divider each have one owning element and no inset highlight shadow.

## Focused comparison evidence

`/private/tmp/digital-twin-divider-comparison.png` places the reported divider-weight screenshot above the final implementation crop. The final crop shows a continuous one-pixel line across the sidebar header and toolbar, plus a one-pixel sidebar edge. The map and content remain directly adjacent to the chrome with no added gap.

## Required fidelity surfaces

- Fonts and typography: the change does not alter font family, size, weight, line height, wrapping, or antialiasing.
- Spacing and layout rhythm: the sidebar header is a fixed 112 px grid with computed rows of 37 px and 44 px; expanded and collapsed measurements are identical. Its bottom is aligned with the 64 px plus 48 px topbar stack.
- Colors and visual tokens: all chrome dividers use the shared `border-sidebar-border` token. Computed light-mode color is `rgb(226, 232, 240)` and dark-mode color is `rgb(30, 41, 59)`.
- Image quality and asset fidelity: map imagery, brand assets, and icon rendering are unchanged.
- Copy and content: no application copy or content changed.

## Interaction and accessibility checks

- Expanded and collapsed the sidebar and measured both states after the transition completed.
- Confirmed the sidebar header uses CSS grid in both states and retains a 44 px region trigger row.
- Toggled dark and light mode and confirmed all four divider surfaces use the same theme color and one-pixel width.
- Existing sidebar trigger names and `aria-expanded` behavior remain intact.
- Console review found no chrome or layout errors. Existing MapLibre unsupported-image errors remain outside this scope.

## Findings

No actionable P0, P1, or P2 alignment, divider, interaction, responsive, or accessibility mismatches remain.

## Comparison history

- Pass 1: the region trigger changed from 44 px to 32 px when collapsed, shortening the sidebar header by 12 px. The collapsed override now changes only width, not height.
- Pass 2: the expanded sidebar header measured 115 px while the toolbar stack measured 112 px. The header now has an explicit 112 px height, aligning both states at y=112.
- Pass 3: all computed borders were one pixel, but the shared glass inset highlight made adjoining dividers appear uneven or doubled. The persistent chrome surfaces now suppress that inset shadow while preserving their glass surface and semantic border token.
- Pass 4: the sidebar header now uses a two-row CSS grid (`minmax(0, 1fr)` plus the 44 px region row), eliminating flex shrink differences between expanded and collapsed content. Final browser measurements show the same 112 px height, one-pixel borders, and border color in both states.

## Follow-up polish

No P3 follow-up is required for this scope.

final result: passed

---

# Digital Twin sidebar design QA

## Comparison target

- Source visual truth: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-1ddd030a-4831-4037-a186-9fa28952a347.png`
- Blank-strip defect reference: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-c2973f3a-8cbb-4fd7-889f-e309640e4f23.png`
- Browser-rendered implementation: `/Users/luke/Documents/Digital_Twin_Frontend/sidebar-implementation.png`
- Side-by-side visual evidence: `/Users/luke/Documents/Digital_Twin_Frontend/sidebar-design-comparison.png`

## Capture details

- Viewport: 1440 × 1140 CSS px in the Codex in-app browser.
- Browser screenshot output: 1440 × 1140 px, normalized to the CSS viewport by the capture API.
- Source sidebar: 181 × 1140 px; implementation sidebar: 192 × 1140 CSS px and captured pixels.
- Density normalization: both sidebar images were compared at 1140 px high; no device-density scaling was needed.
- State: light theme, Live selected, sidebar expanded. A separate collapsed-state inspection was also completed.

## Full-view comparison evidence

`sidebar-implementation.png` shows the updated sidebar in the production map workspace. The sidebar ends at x=192 and the main inset begins at x=192, so there is no unowned strip between navigation and content. The main navigation stays near the top, secondary actions remain bottom anchored, and the version badge replaces the reference profile block.

## Focused comparison evidence

`sidebar-design-comparison.png` places the supplied reference and the implementation crop side by side at equal height. The implementation preserves the reference hierarchy and spacing intent while retaining the existing assigned-region switcher. Direct browser measurements confirmed that the expanded sidebar container and reserved gap are both 192 px wide. In the collapsed state both are 48 px wide, with the main inset beginning at x=48.

## Required fidelity surfaces

- Fonts and typography: existing Inter typography is preserved with compact 14 px navigation labels and a 10 px monospaced version badge.
- Spacing and layout rhythm: main items use consistent 44 px rows; footer actions use 40 px rows; the footer remains bottom anchored at the 1140 px reference height. Container and layout-reservation widths match exactly in expanded and collapsed states.
- Colors and visual tokens: active, foreground, muted, border, and focus colors come from the shared sidebar theme tokens and remain compatible with light and dark mode.
- Image quality and asset fidelity: the brand uses the existing application icon asset; all navigation marks use the installed Lucide icon library. No placeholder or custom-drawn assets were introduced.
- Copy and content: Live, Scenarios, Runs, Alerts, Data, Settings, the assigned region, and the current application version are present. The profile block is intentionally omitted.

## Interaction and accessibility checks

- Expanded and collapsed sidebar states were exercised in the browser. Both states align the sidebar container, reserved gap, and content inset without a blank bar.
- Alerts keeps the user in Live, Data opens the Expert GIS workspace, and Settings opens Administration.
- All actions expose accessible button names; the active destination exposes `aria-current="page"`; collapsed actions retain tooltip labels.
- Console review found no sidebar-specific errors. Existing unavailable local Digital Twin API requests and MapLibre image warnings remain outside this sidebar scope.

## Findings

No actionable P0, P1, or P2 sidebar mismatches remain. The blank bar was caused by applying the 12rem width only to the visible sidebar while the provider still reserved 16rem.

## Comparison history

- Pass 1: the expanded sidebar measured 192 px while its reserved layout gap measured 256 px, creating the reported 64 px blank strip.
- Fix: moved the 12rem width token to `SidebarProvider`, which owns both the visible container and reserved gap.
- Pass 2: expanded measurements matched at 192 px and collapsed measurements matched at 48 px. The revised full-height capture showed no remaining strip.

## Follow-up polish

No P3 follow-up is required for this scope.

final result: passed

---

# Run setup popup design QA

## Comparison target

- Source visual truth: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-a124bc3f-ce19-4ac6-bdd2-8465534bf8d2.png`
- Typography and adjacent-panel revision reference: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-a1739c20-af69-4100-97d4-b689e99c0b0a.png`
- Repetition and summary-placement references: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-d24e0ddc-bb64-44ed-a65b-2c59fd1a4057.png` and `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-9a77e95f-1a9d-4adb-9151-0e1352d17ddb.png`
- Information-density and white-overview reference: `/var/folders/kz/srnv47b15_xbs6pz99d2wjxr0000gp/T/codex-clipboard-b35ba1a3-7b33-44b6-895d-b14411913ebe.png`
- Browser-rendered implementation: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-final.png`
- Weather-adjacent typography implementation: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-weather-typography.png`
- Compact fixed-overview implementation: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-compact-summary.png`
- Expanded Weather implementation: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-weather-expanded.png`
- Expanded Model implementation: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-model-expanded.png`
- Operational Model settings implementation: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-model-settings.png`
- Matched-border implementations: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-matched-area.png`, `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-matched-ignitions.png`, `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-matched-weather.png`, `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-matched-model.png`, and `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-matched-review.png`
- Expanded Review implementation: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-review-expanded.png`
- Focused popup crop: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-final-panel.png`
- Side-by-side visual evidence: `/Users/luke/Documents/Digital_Twin_Frontend/run-setup-design-comparison.png`

## Capture details

- Viewport: 1440 × 1024 CSS px in the Codex in-app browser.
- Browser screenshot output: 1440 × 1024 px, normalized to the CSS viewport by the capture API.
- Source visual: 236 × 594 px.
- Implementation popup: 416 × 831 CSS px and 416 × 831 captured pixels.
- Density normalization: the source was proportionally enlarged to 831 px high; the implementation remained at native 1:1 CSS-pixel scale.
- State: light theme, Ignitions step active, two ignition points placed, redo unavailable, 4-hour run summary.

## Full-view comparison evidence

`run-setup-final.png` shows the popup in its production context over the interactive map at the target desktop viewport. The map remains the dominant surface, the popup stays draggable and right-anchored, persistent navigation remains visible, and the primary action is not clipped.

## Focused comparison evidence

`run-setup-design-comparison.png` places the selected source and the final popup side by side at equal height. The implementation matches the source hierarchy: autosave header, five-step progress navigation, focused Ignitions content, placement action, two-row source list, undo/redo/clear controls, four-row configuration summary, run summary, and bottom-anchored continuation action.

The implementation intentionally omits the source's invented elevation and slope values because the current scenario data model does not provide them. It also uses the product's semantic blue completion token rather than introducing a one-off green success color.

## Required fidelity surfaces

- Fonts and typography: existing Inter typography is preserved. Heading, label, helper, coordinate, and summary weights follow the source hierarchy without clipping or unintended wrapping.
- Spacing and layout rhythm: the 416 × 831 popup preserves the established production size. Step spacing, list rows, summary separators, and the fixed footer align with the source while leaving scroll capacity for longer ignition lists.
- Colors and visual tokens: all styling uses existing semantic background, foreground, muted, border, primary, destructive, and focus-ring tokens. No raw palette values or new visual system were introduced.
- Image quality and asset fidelity: the source contains standard UI icons only. The implementation uses the repository's established Lucide icon dependency and the existing live terrain map; no placeholder, custom-drawn, or rasterized UI assets were added.
- Copy and content: source wording is preserved where it maps to real behavior. Region, coordinates, weather, duration, and ignition counts come from live application state rather than mock text.

## Interaction and accessibility checks

- Created a new scenario, entered a name, moved from Area to Ignitions, placed two sources on the map, and confirmed the source list and run summary updated.
- Undo enabled Redo; Redo restored the removed point; Clear all remained available.
- Continued through Weather and Model to Review and confirmed the final run action became enabled.
- Opened the existing Weather editor from the focused Weather step and dismissed it with the keyboard.
- Step buttons expose `aria-current="step"`; the popup, navigation, summaries, close action, source actions, and map markers have explicit accessible names.
- A fresh browser session found no ScenarioBuilder or marker-root console errors. Existing MapLibre terrain/image warnings remain outside this popup scope.

## Findings

No actionable P0, P1, or P2 visual, interaction, responsive, or accessibility mismatches remain.

## Comparison history

- Pass 1: the structure and proportions matched, but ignition rows were less scannable than the source and the middle control still used the old Focus action. These were P2 fidelity differences.
- Fixes: added destructive fire-source markers with explicit row numbers, changed the active step indicator to its step number, and replaced Focus with a functional Redo action while retaining Undo and Clear all.
- Pass 2: the final browser capture and side-by-side comparison showed no remaining P0/P1/P2 differences. Popup interactions and the marker cleanup path were retested in a fresh browser session.
- Pass 3: the Weather-adjacent reference exposed a P2 scale mismatch: the setup popup used 9–11 px text beside a Weather panel built around 11–16 px UI text. The setup title and section headings now use the Weather panel's 16 px heading scale; helper text, navigation labels, coordinates, summaries, and metrics were raised in proportion. The wide continuation button was replaced with previous/next arrow buttons and a centered `step · position` label. Browser verification confirmed both arrow directions navigate correctly, the active Weather and Model states render, and the two panels now read at the same visual scale.
- Pass 4: the repeated four-row configuration block and Run summary made every step share most of the same content. Both were removed from the scrollable step body. A compact fixed overview now sits immediately above the arrow footer with four equal, icon-led targets for Area, Weather, Model, and Duration. Browser verification confirmed the sparse Weather step has a distinct composition, the overview remains at the bottom, and each overview target returns to its corresponding setup step.
- Pass 5: the fixed overview now uses the semantic white background surface. Each step exposes distinct, real configuration depth: Area includes selected-region context, Weather shows date/time/season/temperature/wind and event values, Model adds duration presets plus execution/output context, and Review provides a navigable readiness checklist. Ignitions retains its source-management controls. No unsupported backend switches were invented. Browser verification confirmed duration presets update the overview, Weather Edit opens the full editor, and Review rows return to their associated setup steps.
- Pass 6: removed the low-value duration presets and implementation-detail rows from Model. Replaced them with persisted operational inputs for fuel moisture, ember spotting range, crown-fire behavior, grid resolution, and output interval. Fuel, spotting, and crown-fire choices change the local behavior curve; output interval controls replay sampling. The compact overview and Review step now summarize the selected grid/output configuration. A live 1280 × 720 check found and corrected truncation in the spotting selector; the final values fit without clipping.
- Pass 7: flattened every setup page by removing gray grouping fills, then restored the stronger Weather-panel outline treatment using the shared `border-input` token. Area context, ignition rows, Weather data/events, Model behavior/computation settings, Review rows, header, overview, and footer now share white surfaces with consistent outlined grouping and separators. All five steps were captured and inspected at 1280 × 720.

## Follow-up polish

- P3: if the API later exposes terrain elevation and slope per source, those values can be added to the ignition rows without changing the layout.

final result: passed
