# Safety Rules

These gates override autonomy for destructive, irreversible, production, or
privacy-sensitive actions.

## Protect data and user work

- Never edit `.git`, installed dependencies, or generated build/test output
  directly. Change sources and regenerate through canonical commands.
- Treat `.env`, credentials, tokens, mailbox content, auth state, and private
  personal data as sensitive. Read or modify them only when directly required
  and authorized; never print, store in prompts, or commit them.
- Use placeholders in examples and reviewed secret-storage mechanisms in
  runtime configuration.
- Inspect dirty state before editing or staging. Preserve unrelated changes and
  stop when safe ownership cannot be established.

## Dangerous Operations

- Obtain explicit permission before recursive or bulk deletion, force push,
  history reset, destructive restore, production mutation, dropping data, or
  installing undeclared dependencies.
- Resolve exact targets with read-only checks first. Never aim destructive
  commands at a home directory, workspace root, unresolved variable, or broad
  glob.
- Prefer recoverable and canonical workflows. Production deploy, rollback,
  parity, database, and release work must use its routed governance skill.

## Error Handling

If a failure may have changed external state or made retry unsafe, stop and
report the attempted action, observed state, and recovery options. Diagnose and
retry ordinary reversible failures within scope.
