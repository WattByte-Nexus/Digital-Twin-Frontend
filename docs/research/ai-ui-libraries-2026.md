# AI-aware UI libraries for GeoLibre

Research date: 2026-08-07

## Decision summary

GeoLibre already has the hard, domain-specific part: a browser-side Strands agent, typed GeoLibre tools, semantic layer context, provider selection, streamed output, and approval gates for model-authored code. A library should therefore be judged primarily on whether it can replace or strengthen the chat and agent/UI integration layer without displacing those tools.

- **Best incremental fit: assistant-ui.** Use its composable React chat primitives and custom runtime/tool rendering while retaining the existing Strands session and GeoLibre tool layer.
- **Best full agentic-UI framework: CopilotKit.** Choose it if GeoLibre wants bidirectional shared state, frontend tools, human-in-the-loop workflows, generative UI, and an AG-UI boundary as first-class architecture. Its official integrations include Strands TypeScript.
- **Best low-level toolkit: Vercel AI SDK.** Strong provider abstraction, streaming, tool calling, and typed UI messages, but more application plumbing remains GeoLibre's responsibility.
- **Best long-term protocol boundary: AG-UI.** It is a protocol rather than a finished chat component; use it to decouple a future agent backend from any one frontend library.
- **Best OpenAI-centered drop-in: ChatKit.** It supplies a highly finished embedded chat, widgets, threads, attachments, and client tools, but its UI is hosted in an OpenAI iframe and its architecture is less aligned with GeoLibre's local-first, multi-provider posture.
- **MCP/MCP Apps solve a different boundary.** MCP exposes tools and data to agents; MCP Apps can also ship interactive widgets to compatible hosts. They do not by themselves add an in-product chat or automatically understand the React UI.

## Comparison

| Option | What it provides | UI/application awareness | Backend coupling | GeoLibre fit |
| --- | --- | --- | --- | --- |
| CopilotKit | React chat, headless UI, frontend tools, shared state, generative UI, approvals, threads | First-class context, frontend tools, and bidirectional agent state | AG-UI runtime; supports many agent frameworks including Strands | Strong when adopting a broader agentic-UI architecture |
| assistant-ui | Composable React primitives, chat state, runtimes, toolkits/renderers, MCP and AG-UI integrations | Explicit model context and frontend/backend/human tools | Works with AI SDK, AG-UI, custom protocols, or an external store | Strongest incremental UI replacement |
| Vercel AI SDK + AI Elements | Model/provider abstraction, streaming, agents, tool calls, typed UI messages, UI component registry | Explicit tools and message data; no automatic application-state bridge | Provider-agnostic but application owns orchestration and state exposure | Useful runtime foundation; more custom work |
| AG-UI | Open event protocol for runs, messages, tools, shared state, interrupts, and custom events | Standardizes context/tools/state rather than rendering the UI | Agent-framework neutral | Good architectural seam if the agent moves out of process |
| OpenAI ChatKit | Finished embedded chat, streaming, widgets, threads, files, annotations, client tools | Client tools and injected context; not a general React-state bridge | OpenAI-hosted UI iframe; managed or self-hosted Python backend | Fastest polished chat, weaker local-first/multi-provider fit |
| MCP / MCP Apps | Standardized agent access to tools/data; portable interactive resources/widgets | Tools query the application domain, not the DOM | Host/client support required | Complementary export/integration surface, not the primary chat UI |

## Architectural guidance

“Query the UI” should mean exposing a curated semantic projection of application state and a typed set of actions. It should not mean letting a model scrape or manipulate arbitrary DOM. Keep reads narrow, route writes through existing store commands, require confirmation for destructive or code-execution tools, and return structured results that the chat can render as trusted components.

For a staged adoption:

1. Preserve `AssistantSession`, provider selection, and the GeoLibre tool definitions.
2. Prototype assistant-ui around the existing async stream and add typed renderers for a few high-value tool results (layer list, SQL table, algorithm result, approval).
3. Introduce an internal semantic context selector so the agent sees selected layers, viewport, active panel, and user selection without serializing the entire store.
4. Evaluate AG-UI/CopilotKit only when remote execution, persistent threads, resumable runs, multi-agent workflows, or bidirectional streamed state become concrete requirements.
5. Expose selected GeoLibre capabilities over MCP separately if external assistants should operate GeoLibre.

## Primary sources

- [CopilotKit documentation](https://docs.copilotkit.ai/)
- [CopilotKit frontend tools](https://docs.copilotkit.ai/frontend-tools)
- [CopilotKit shared state](https://docs.copilotkit.ai/shared-state)
- [assistant-ui documentation](https://www.assistant-ui.com/docs)
- [assistant-ui tools](https://www.assistant-ui.com/docs/tools)
- [assistant-ui architecture](https://www.assistant-ui.com/docs/architecture)
- [Vercel AI SDK](https://vercel.com/ai-sdk)
- [AI SDK UI reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui)
- [AG-UI overview](https://docs.ag-ui.com/)
- [AG-UI state management](https://docs.ag-ui.com/concepts/state)
- [OpenAI ChatKit.js](https://openai.github.io/chatkit-js/)
- [OpenAI Apps SDK overview](https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk)
- [CopilotKit repository and license](https://github.com/CopilotKit/CopilotKit)
- [assistant-ui repository and license](https://github.com/assistant-ui/assistant-ui)
- [Vercel AI SDK repository](https://github.com/vercel/ai)
- [AG-UI repository and license](https://github.com/ag-ui-protocol/ag-ui)
