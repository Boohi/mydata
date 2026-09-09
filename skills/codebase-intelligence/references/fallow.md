# Fallow CLI Reference

Read this only after routing a TypeScript/JavaScript structural-analysis task to
Fallow. It is vendor-specific operating detail, not default agent context.

## Reviewed Snapshot

- Pilot version: `fallow@3.9.1` (2026-07-27).
- License: MIT static-analysis layer.
- Runtime: npm wrapper requires Node 22 or newer.
- Interfaces: CLI is primary; the optional MCP server wraps the CLI.
- Scope: syntactic module-graph analysis, not TypeScript type resolution.
- Paid runtime intelligence is separate and out of scope.

Primary sources:

- [Repository and license](https://github.com/fallow-rs/fallow)
- [Agent and MCP integration](https://fallow.tools/docs/integrations/mcp/)
- [Global flags](https://fallow.tools/docs/cli/global-flags/)
- [Analysis limitations](https://fallow.tools/docs/analysis/limitations/)

The project is young and releases frequently. Treat its performance and
completeness claims as vendor claims until a local pilot confirms them.

## Safe Report-Only Pilot

Use a disposable clone or tracked-file snapshot of a small, noncritical
project. Verify the source checkout before and after. Do not include untracked
files, environment files, credentials, or generated secrets.

Prefer a repo-pinned script when one exists. Otherwise, after reviewing the
package and allowing the one-off download, use an exact version:

```bash
DO_NOT_TRACK=1 npm exec --yes --package=fallow@3.9.1 -- \
  fallow --root "$pilot_root" --format json --quiet --no-cache
```

Useful report-only variants:

```bash
DO_NOT_TRACK=1 npm exec --yes --package=fallow@3.9.1 -- \
  fallow --root "$pilot_root" --format json --quiet --no-cache list

DO_NOT_TRACK=1 npm exec --yes --package=fallow@3.9.1 -- \
  fallow --root "$pilot_root" --format json --quiet --no-cache \
  audit --base main
```

Use a task-specific variable such as `pilot_root`; do not reuse system
variables. The package executor downloads code into its cache, so exact-version
pinning does not remove the need to review package provenance and integrity.

Do not run these during a pilot:

- `fix`, `init`, `hooks`, `watch`, `coverage`, `license`, or telemetry setup
- MCP registration
- automatic deletion or allowlisting
- CI or pre-commit gate installation

Exit code `1` can mean findings were reported; exit code `2` or higher is a tool
error. Preserve the structured report outside the source checkout or in an
already-ignored project evidence directory.

## Finding Review

Before accepting a finding, check:

- dynamic imports, subprocess entry points, test fixtures, and shell references;
- framework or bundler convention entry points;
- generated, vendored, migration, and codegen output;
- reflection, dependency injection, decorators, and native bindings;
- package scripts and binaries;
- whether duplicated UI or test structure is intentionally parallel.

Trace a bounded sample before proposing cleanup. Report aggregate counts, not
raw source or proprietary snippets. Classify uncertain results rather than
weakening the analyzer with an unowned permanent ignore.

## Project Adoption

A project may adopt Fallow after the pilot shows unique, actionable signal:

1. Open a focused issue with the reviewed baseline and false-positive notes.
2. Pin it through the project's package manager and lockfile.
3. Add the smallest config needed for real entry points and ignore patterns.
4. Start with a report-only package script.
5. Add a changed-code audit or CI gate only after the baseline is reviewed.
6. Require issue links, owners, and expiry dates for suppressions.

Keep Knip instead when the repo already relies on its plugin coverage or cannot
run Node 22. Do not install both without evidence that each finds a distinct
class of required issues.

MCP adds no analysis beyond the CLI and expands default tool context. Revisit it
only after repeated evidence that structured invocation materially outperforms
CLI JSON in supported clients.

