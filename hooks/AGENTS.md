# Hooks Instructions

Applies to files under `hooks/`.

## Hook Contract

- Hooks consume JSON payload from stdin.
- Hooks must tolerate missing fields.
- Use exit code `2` only when intentionally blocking action.
- Use exit code `0` for soft warnings/non-blocking reminders.

## Performance

- Keep hooks fast and deterministic.
- Prefer async hook execution for long-running checks.
- Add debounce/locking for expensive repeated checks.

## Safety

- Never leak secrets from payloads.
- Keep blocking rules narrow and actionable.
- Include clear stderr guidance when blocking.

## Validation

After hook changes, run:

```bash
bash -n hooks/*.sh
node --test tests/*.mjs
```
