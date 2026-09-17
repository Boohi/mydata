---
name: codebase-triage
description: Audit a codebase and turn validated findings into prioritized, de-duplicated GitHub issues.
---

# Codebase Triage

Convert repository evidence into a useful backlog. Use this for audit and
planning; do not edit product code unless the user also asks for fixes.

## Workflow

1. Read nearest local instructions and run repository docs/memory discovery
   when available.
2. Map entry points, domains, data flows, dependencies, tests, CI, deployment,
   generated paths, recent changes, open PRs, and existing issues.
3. Run safe targeted checks and search for concrete signals: failing or missing
   tests, unchecked errors, duplication, stale docs, weak boundaries, security
   risks, performance/cost hotspots, observability gaps, and awkward user
   journeys.
4. Separate confirmed findings from hypotheses. Record evidence, impact,
   confidence, and the smallest useful scope.
5. Load [triage lenses](references/triage-lenses.md) for deeper scoring, ideation,
   or issue templates. For architecture friction, use
   [architecture review](references/architecture-review.md); for incoming reports,
   use [request triage](references/request-triage.md).
6. Present a prioritized candidate table before tracker mutation.

Suggested columns: priority, type, title, evidence, impact, scope, confidence.
Use `P0` only for urgent security, data-loss, incident, or severe correctness
risk; `P1` for high-impact blockers; `P2` for important improvements; and `P3`
for polish or exploration.

## GitHub Policy

By default, de-duplicate and file GitHub issues for actionable findings when
the repository and authentication are available. `issue-sync` controls this
step:

- search open/closed issues and recent PRs first;
- update a matching issue instead of creating a duplicate;
- use repository issue templates when present;
- link evidence, related PRs, parent issue, and dependencies;
- for large sweeps, use a parent issue or capped action backlog.

Do not create more than 10 issues in one pass without confirming the candidate
list. Skip mutation when the user requests report-only output or GitHub context,
network, or authentication is unavailable; provide the backlog and blocker
instead.

Each ticket needs why now, exact evidence, a bounded proposed scope,
verifiable acceptance criteria, and risks/open questions. Mark unverified ideas
as hypotheses or spikes. Avoid vague tickets such as “Improve tests.”

## Guardrails

- Never invent defects or turn every observation into an issue.
- Do not include secrets, credentials, customer data, raw `.env` contents, or
  unnecessarily private logs.
- Keep production deploy/release/rollback work under repository release
  governance.
- Report failed checks exactly and distinguish baseline failures from findings
  introduced by the audit.

Finish with the candidate backlog, issues created or updated, duplicates
avoided, checks run, and unresolved access or evidence gaps.
