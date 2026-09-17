---
applyTo: "scripts/**/*.sh,hooks/**/*.sh,skills/**/scripts/**/*.sh"
---

When editing shell scripts:

- Keep scripts POSIX-friendly where practical and avoid shell-specific surprises.
- Quote paths and variables to handle spaces safely.
- Keep `--help` usage examples up to date with actual flags.
- Prefer idempotent behavior so setup can be rerun safely.
