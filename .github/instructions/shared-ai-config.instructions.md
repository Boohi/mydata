---
applyTo: "**"
---

Keep changes minimal and deterministic.

- Preserve compatibility for Claude Code, Codex, OpenCode, and GitHub Copilot.
- Keep continuous memory behavior aligned across all supported tools.
- Prefer shared automation in `scripts/` over manual per-project steps.
- If setup behavior changes, update `README.md` and any impacted docs in `docs/`.
- Validate script syntax (`bash -n`) and run relevant tests before finishing.
