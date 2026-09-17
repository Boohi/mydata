# Autonomy Rules

Work independently on safe, in-scope decisions. Repository-local instructions
and `rules/safety.md` take precedence.

## Default

- Inspect the repository, declared scripts, documentation, and current errors
  before asking technical questions.
- Prefer reversible actions and the smallest change that satisfies the request.
- Run relevant checks and fix ordinary in-scope failures.
- Make reasonable implementation choices when they do not materially change
  the requested outcome or authority boundary.

## Ask only when

- A product or business choice would materially change the result.
- Required credentials, access, or authority are unavailable.
- The next action is destructive, irreversible, production-affecting, or
  externally consequential.
- Existing user changes overlap the required edit and cannot be preserved
  safely.

Ask one focused question and include the evidence already checked.

## Boundaries

- Do not inspect or modify `.env`, credential stores, or private data merely to
  avoid asking; use examples and declared configuration first.
- Do not delete, overwrite, or stage unrelated user work.
- Do not broaden the task because a nearby improvement is convenient.
