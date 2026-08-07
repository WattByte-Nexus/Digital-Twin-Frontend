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

<!-- agentq:end -->

## UI component system

- Use shadcn/ui for every available React UI primitive and layout pattern, including navigation, avatars, badges and status pills, menus, dialogs, popovers, tooltips, and form controls. Before creating UI, check the shadcn registry and the existing `@geolibre/ui` package. Product components may compose and customize shadcn primitives, but must not replace an available shadcn primitive or registry pattern with bespoke markup.
- Shared primitives, patterns, and broadly reusable composed components belong in `packages/ui`. Product-specific orchestration belongs in the consuming app. Prefer extending or composing a shared component over duplicating markup, styles, or interaction logic.
- Keep components focused. Split complex UI into named subcomponents when they own a distinct layout, state, or interaction concern. Avoid monolithic components and speculative abstraction.
- All components must use the semantic design tokens defined in `packages/ui/src/globals.css`. Do not introduce one-off color systems, radii, shadows, or focus treatments inside feature components.
- Use the shared glass-surface theme for translucent application chrome. Preserve accessibility: readable contrast, visible focus states, keyboard operation, and reduced-motion support take priority over decorative effects.
- Every component must support light and dark mode; portalled dropdowns, popovers, tooltips, and modals triggered by a component must explicitly match that component's active theme, use the shared glass-surface treatment, and match or expand from the trigger width when the content needs it.
- Add shadcn components through the repository's `components.json` configuration so source, dependencies, aliases, and styling remain consistent. Keep the generated source owned by `packages/ui` and customize it there when product requirements demand it.
- Do not add backgrounds to Storybook stories unless the story's requirements explicitly specify one.
