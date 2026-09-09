# CLI-First Development

Prefer a CLI or scriptable seam when a feature benefits from automation,
repeatable verification, or non-UI reuse. Do not delay a primarily visual task
to invent an unnecessary CLI.

## Contract

- Put reusable behavior in a library/module shared by CLI and UI adapters.
- Follow existing command conventions and package scripts.
- Return zero on success and non-zero on failure; send results to stdout and
  diagnostics to stderr.
- Provide concise `--help`; add structured output such as `--json` when agents
  or scripts need it.
- Verify behavior by running the real command, including an error case.

Use the routed TDD and documentation workflows for implementation detail.
