---
description: "Run strict agentic TDD loop (red -> green -> refactor -> verify)"
---

Execute this task with the shared `tdd-ops` workflow:

1. Plan one coherent implementation slice and its verification boundaries.
2. Add or update a focused test first, include an edge or error case, and run
   it once to produce the failing state (Red).
3. Implement the complete planned slice. Use targeted checks only at
   meaningful boundaries, not after every edit.
4. Confirm the focused test is Green at the completed-slice boundary, then
   refactor and rerun it because the implementation changed.
5. Run broad verification once near handoff, before risky external mutation,
   or where repository policy requires it. Reuse conclusive results when source,
   tests, configuration, dependencies, and environment are unchanged.
6. Report changed test files plus exact commands/results.
