# Skills Instructions

Applies to files under `skills/`.

## Skill Design

- Keep each skill focused on one domain/workflow.
- Put repeatable command logic in `scripts/` under each skill.
- Avoid hardcoded absolute paths.
- Prefer `~/...` or workspace-relative examples.

## Skill Content

Each `SKILL.md` should include:

- a narrow trigger and explicit non-trigger when ambiguity is likely
- the shortest safe operating workflow
- prerequisites or approval boundaries that materially affect execution
- exact verification or one canonical helper command

Keep entrypoints readable in one pass. Put exhaustive command catalogs, schema
detail, recovery procedures, lengthy examples, and rare troubleshooting in
`references/` and link them only from the phase that needs them. Do not repeat
baseline safety, Git, TDD, or completion prose already routed by `AGENTS.md`.

## Cross-Tool Consistency

- Keep guidance portable across Claude Code, Codex, OpenCode, and Copilot.
- Do not require tool-specific editing primitives.

## Security

- Never include real credentials or tokens in examples.
- Do not instruct committing secrets.
