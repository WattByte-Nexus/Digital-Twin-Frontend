<!-- agentq:start -->
## agentq task queues

This repository uses [agentq](https://github.com/Luke-Pitstick/agentq) for durable coding-agent task queues.

When asked to record or delegate follow-up work, use the installed CLI rather than keeping an informal TODO:

```bash
agentq task add --queue <queue> --title "Short task title" --instructions "Complete, standalone instructions" --provider codex
```

For machine-generated tasks, prefer JSON on stdin:

```bash
printf '%s' '{"queue":"<queue>","title":"Short task title","instructions":"Complete instructions","provider":"claude","idempotencyKey":"stable-key"}' | agentq task add --stdin-json
```

Inside an agentq-managed run, `AGENTQ_QUEUE`, `AGENTQ_TASK_ID`, and `AGENTQ_RUN_ID` are set. Tasks created there are automatically linked to their parent task. Do not enqueue duplicates or recursively enqueue the current task.

Do not index a transient AgentQ worktree with codebase-memory-mcp by default. Use the canonical repository graph for stable code discovery and direct file reads for worktree-only changes. Index the transient worktree only when its uncommitted changes specifically require graph analysis.

<!-- agentq:end -->

## UI component system

- Use shadcn/ui for every available React UI primitive and layout pattern, including navigation, avatars, badges and status pills, menus, dialogs, popovers, tooltips, and form controls. Before creating UI, check the shadcn registry and the existing `@geolibre/ui` package. Product components may compose and customize shadcn primitives, but must not replace an available shadcn primitive or registry pattern with bespoke markup.
- Shared primitives, patterns, and broadly reusable composed components belong in `packages/ui`. Product-specific orchestration belongs in the consuming app. Prefer extending or composing a shared component over duplicating markup, styles, or interaction logic.
- Keep components focused. Split complex UI into named subcomponents when they own a distinct layout, state, or interaction concern. Avoid monolithic components and speculative abstraction.
- All components must use the semantic design tokens defined in `packages/ui/src/globals.css`. Do not introduce one-off color systems, radii, shadows, or focus treatments inside feature components.
- New component files must pass `theme/no-raw-theme-colors`: use semantic theme utilities instead of raw Tailwind palette colors or hard-coded presentation colors. `eslint-rules/theme-color-legacy-files.mjs` is a shrink-only migration list; never add a new component to it.
- Use the shared glass-surface theme for translucent application chrome. Preserve accessibility: readable contrast, visible focus states, keyboard operation, and reduced-motion support take priority over decorative effects.
- Every component must support light and dark mode; portalled dropdowns, popovers, tooltips, and modals triggered by a component must explicitly match that component's active theme, use the shared glass-surface treatment, and match or expand from the trigger width when the content needs it.
- Add shadcn components through the repository's `components.json` configuration so source, dependencies, aliases, and styling remain consistent. Keep the generated source owned by `packages/ui` and customize it there when product requirements demand it.
- Do not add backgrounds to Storybook stories unless the story's requirements explicitly specify one.

## Frontend taste and interaction quality

- Treat visual quality as an implementation requirement, not optional polish. Reuse the design system first; when a new visual or interaction choice is necessary, be able to state why it improves hierarchy, clarity, responsiveness, or spatial continuity instead of choosing an arbitrary value.
- Use motion to explain cause, relationship, or state change. Keep micro-interactions at 100–150ms, tooltips and dropdowns at 150–250ms, and modals and drawers at 200–300ms. Keep UI motion under 300ms, let larger or farther-traveling elements take longer, and make exits about 20% faster than entrances.
- Choose easing by behavior: `ease-out` for entering or exiting, `ease-in-out` for movement or morphing already on screen, `ease` for hover transitions, and `linear` only for constant motion.
- Elements that appear with scale should usually start near `scale(0.95)`, not `scale(0)`. Set popover and menu `transform-origin` toward their trigger so motion preserves spatial continuity.
- Give pressable controls tactile feedback such as `scale(0.97)` on `:active` when appropriate, without changing layout. Maintain at least a 44px pointer hit area for small controls, using a pseudo-element when the visible control should remain smaller.
- If a hover transition flickers, animate a child surface instead of the hover-sensitive parent. Use `will-change: transform` only for a demonstrated transform-animation jitter, and remove it when the animation is inactive if practical.
- Tooltip groups should avoid replaying the full delay and entrance animation as users move between adjacent triggers. If an appearance transition still feels visually harsh, a subtle blur below 20px may help, but never use blur to hide layout, state, or performance defects.
- Respect `prefers-reduced-motion`; the interface must remain understandable when nonessential motion is removed.
- Keep prose line length near 65ch. Use `tabular-nums` for aligned numeric columns, the `…` character rather than three periods in authored UI copy, and looser tracking for uppercase labels.
- Choose font fallbacks with similar x-height and weight to reduce layout shift. Reserve underlines for links, prefer weight or color for non-link emphasis, use bold for interface hierarchy, and reserve italics mainly for citations or linguistic stress in prose.
