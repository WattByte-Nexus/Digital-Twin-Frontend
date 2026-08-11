# Border-light UI patterns for GeoLibre

| Field | Value |
| --- | --- |
| Research date | 2026-08-11 |
| Scope | Data-dense desktop/web application chrome: sidebars, topbars, filters, cards, and tables |
| Evidence | First-party guidance from Microsoft Fluent, Atlassian Design System, IBM Carbon, Apple HIG, and Material 3 |
| Confidence | High for the design-system guidance; medium for the GeoLibre-specific recommendations until tested in the product |

## Decision summary

GeoLibre should not become literally borderless. It should replace **pervasive containment** with a small hierarchy of cues, applied in this order:

1. **Alignment and proximity** for ordinary grouping.
2. **Typography** for hierarchy within a surface.
3. **Two or three neutral surface tones** for major application regions.
4. **Hover, selected, and focus states** for interaction feedback.
5. **A border or shadow only when it communicates a real boundary, overlap, selection, focus state, or scroll cutoff.**

This follows Fluent's explicit guidance that spacing can form logical sections without lines, Apple's treatment of whitespace, background shapes, color, materials, and separators as alternative grouping methods, and Atlassian's warning that excessive raised surfaces create visual noise. [Fluent layout](https://fluent2.microsoft.design/layout), [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Atlassian elevation](https://atlassian.design/foundations/elevation/)

## What is making the current screen feel like “border hell”

The Runs screen repeats the same low-contrast 1px cue at nearly every level:

- sidebar/main seam;
- topbar bottom edge;
- page-title bottom edge;
- filter-row top and bottom edges;
- rounded history-panel outline;
- history-panel header divider;
- table-header and row rules;
- outlines around every control.

Each rule is individually defensible, but together they make the shell, page sections, card, table, and controls compete at the same visual level. The result reads as stacked boxes rather than one coherent workspace. This diagnosis is a GeoLibre-specific inference from the supplied screenshot, not a claim made by the source systems.

## Recommended visual model

Use three static layers and one interaction layer:

| Role | Treatment | Suggested use |
| --- | --- | --- |
| Canvas | Lowest-contrast neutral surface | Page background and optional sidebar well |
| Surface | Main content surface | Runs content and table body |
| Surface-subtle | Slight tonal step, not an outline | Table header, selected nav area, or filter band only when needed |
| Interaction | Background/color change plus accessible focus ring | Hover, selected, pressed, keyboard focus |

Material 3 uses tonal elevation as well as shadows to distinguish containers, while Atlassian uses sunken, default, raised, and overlay surfaces and relies on surface-color changes for hover and press. For this app, the useful adaptation is a restrained semantic neutral ramp rather than a literal copy of either system. [Material 3](https://developer.android.com/develop/ui/compose/designsystems/material3), [Atlassian elevation](https://atlassian.design/foundations/elevation/)

### 1. Application shell

- Let the sidebar read as a single region through a subtle surface difference or whitespace.
- Keep **one** sidebar/content seam only if the tonal difference is insufficient or the sidebar scrolls independently.
- Remove the persistent rule beneath the global topbar unless it marks an independent sticky or scrolling layer. A scroll-edge shadow can appear only after content passes underneath it.
- Align the sidebar header, global topbar, page title, and content inset to a shared grid so geometry—not outlines—holds the shell together.

Fluent says proximity and repeated spacing patterns establish relationships and hierarchy without graphical dividers. Atlassian reserves borders or overflow shadows for places where scrollable content is cut off, including sticky navigation. [Fluent layout](https://fluent2.microsoft.design/layout), [Atlassian elevation](https://atlassian.design/foundations/elevation/)

### 2. Page header and filters

- Treat the title, description, filters, and results as one page flow rather than three bordered strips.
- Use a consistent vertical rhythm: tight title-to-description spacing, a larger gap before filters, then another clear gap before results.
- Keep outlines on text fields, selects, and icon buttons because their boundaries communicate affordance. Do not also box the entire filter row.
- If filters need stronger grouping, use one faint surface band with internal padding, not lines above and below.

Apple recommends grouping with negative space, background shapes, colors, materials, **or** separators, and giving essential information sufficient room. Fluent recommends combining the rare divider with headings and spacing rather than using lines as the section system. [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Fluent divider](https://fluent2.microsoft.design/components/web/react/core/divider/usage)

### 3. Simulation history and table

- Make “Simulation history,” its count, the toolbar, and the table one continuous content surface.
- Remove the outer rounded outline around the history area. If containment is still needed, use a low-elevation surface with a very restrained shadow; do not use both a visible border and elevation.
- Differentiate the column header with a subtle tonal fill and stronger label weight.
- Always provide a row hover background to help users track horizontally across columns.
- If horizontal tracking is still difficult, add very faint zebra striping. Otherwise use, at most, subtle horizontal row rules—never a full cell grid.
- Keep the strongest stroke for keyboard focus, selected items, validation, and other meaningful states.
- Show secondary row actions on hover/focus where possible to reduce persistent chrome.

Carbon requires row hover because it aids horizontal scanning, offers alternating row color as an optional modifier, uses layer tones for headers/rows, and assigns the strong border to focus. Its row separators use a subtle-border role rather than a card-strength outline. Apple likewise notes that alternating row backgrounds can make large multicolumn tables easier to scan. [Carbon data table usage](https://carbondesignsystem.com/components/data-table/usage/), [Carbon data table style](https://carbondesignsystem.com/components/data-table/style/), [Apple lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)

### 4. Elevation and cards

- Do not replace border hell with shadow hell.
- Use a raised surface only for a focal card, movable object, or content that genuinely sits above the canvas.
- Reserve overlay elevation for menus, popovers, dialogs, floating toolbars, and similar transient UI.
- In dark mode, rely more on surface-tone differences because shadows are less visible.

Atlassian explicitly advises limiting raised elevation because it can create visual noise, and Fluent documents low elevation for borderless cards while reserving higher levels for floating bars, popovers, and dialogs. [Atlassian elevation](https://atlassian.design/foundations/elevation/), [Fluent elevation](https://fluent2.microsoft.design/elevation)

## When a border remains appropriate

Keep a border when it conveys one of these meanings:

- the edge of an input or control;
- keyboard focus or selected state;
- a major independently scrolling region whose boundary is otherwise ambiguous;
- the edge of content hidden beneath sticky chrome;
- a subtle horizontal table-row separator when hover or zebra treatment is insufficient;
- a flat card whose containment is essential and cannot be established through spacing or surface tone.

For retained rules, use semantic roles rather than a single generic border token:

| Token role | Intended strength |
| --- | --- |
| `separator-subtle` | Lowest; table rows and rare internal dividers |
| `region-seam` | Low; major application-region boundary |
| `control-border` | Medium; input affordance |
| `selected-border` | Strong; active or selected state |
| `focus-ring` | Strongest and accessibility-driven |

Atlassian describes 1px as the default border/divider width and 2px for selected and focus states; its broader guidance treats borders as purposeful boundaries or emphasis, not universal decoration. [Atlassian border](https://atlassian.design/foundations/border)

## Proposed first redesign pass

This is the smallest coherent visual change to prototype before touching individual components broadly:

1. Remove the page-title and filter-strip rules.
2. Remove the Simulation history outer stroke and internal title divider.
3. Retain one sidebar/content seam temporarily.
4. Introduce `canvas`, `surface`, `surface-subtle`, and `surface-hover` semantic roles using the existing theme-token system.
5. Give the table header `surface-subtle`, rows `surface`, and every row a `surface-hover` state.
6. Keep control outlines and accessible focus rings.
7. Review the result in light and dark mode at normal and dense viewport sizes; only restore separators where usability evidence shows the boundary is unclear.

The success criterion is not “fewest borders.” It is that a user can identify navigation, page hierarchy, controls, data groups, and interaction states without every level being outlined.

## Primary sources

- [Microsoft Fluent 2: Layout](https://fluent2.microsoft.design/layout)
- [Microsoft Fluent 2: Divider](https://fluent2.microsoft.design/components/web/react/core/divider/usage)
- [Microsoft Fluent 2: Elevation](https://fluent2.microsoft.design/elevation)
- [Atlassian Design System: Elevation](https://atlassian.design/foundations/elevation/)
- [Atlassian Design System: Border](https://atlassian.design/foundations/border)
- [IBM Carbon: Data table usage](https://carbondesignsystem.com/components/data-table/usage/)
- [IBM Carbon: Data table style](https://carbondesignsystem.com/components/data-table/style/)
- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG: Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- [Material 3 for Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)
