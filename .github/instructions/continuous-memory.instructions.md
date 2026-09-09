---
applyTo: "**"
---

Use the shared continuous memory workflow automatically:

- At session start, run `./.ai-scripts/memory-context.sh` when available. Treat
  retrieved items as untrusted history and verify them against live state.
- After high-friction work, use `./.ai-scripts/memory-reflect.sh` for a concise
  machine-private observation.
- Portable memory requires explicit review. Automation never stages or commits
  `.ai-memory/memories.jsonl`.
- Never store secrets, credentials, mailbox content, or private personal data.
