# Scripts Instructions

Applies to files under `scripts/`.

## Goals

- Keep scripts idempotent and rerunnable.
- Keep behavior manifest-driven where possible (`config/platforms.json`).
- Preserve portability across macOS/Linux.

## Editing Rules

- Quote all paths/variables.
- Provide `--help` for non-trivial scripts.
- Avoid hardcoded user/machine paths.
- Prefer `node` helpers for JSON parsing instead of brittle shell parsing.

## Validation

When changing scripts, run:

```bash
bash -n scripts/*.sh
node --test tests/*.mjs
```

Run targeted commands for modified scripts (`setup-project.sh`, `apply-mcp.sh`, `doctor.sh`, etc.).

## Docs

If behavior or flags change, update:

- `README.md`
- `docs/config-operations.md`
- any other impacted docs under `docs/`
