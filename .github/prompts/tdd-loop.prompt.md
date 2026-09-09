---
mode: "agent"
description: "Apply strict agentic TDD loop for implementation tasks"
tools:
  - "codebase"
  - "changes"
---

Use the shared `tdd-ops` workflow for this change:

1. Plan one coherent implementation slice and its verification boundaries.
2. Write or update a focused test first, cover an edge or error case, and run
   it once to confirm failure.
3. Implement the complete planned slice. Use targeted checks only at meaningful
   boundaries, not after every edit.
4. Confirm the focused test is Green at the completed-slice boundary, then
   refactor and rerun it because the implementation changed.
5. Run broad verification once near handoff, before risky external mutation,
   or where repository policy requires it. Reuse conclusive results when source,
   tests, configuration, dependencies, and environment are unchanged.
6. Return changed test files and exact commands/results.
