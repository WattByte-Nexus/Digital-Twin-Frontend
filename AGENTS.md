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
