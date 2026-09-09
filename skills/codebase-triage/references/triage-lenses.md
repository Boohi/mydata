# Triage Lenses

Use these lenses after the initial repository map is clear. Prefer a few
high-quality issues over a large pile of thin observations.

## Scoring

Score each candidate before creating tickets:

| Field | Values | Guidance |
| --- | --- | --- |
| Impact | High / Medium / Low | User pain, revenue risk, operational risk, developer drag, or strategic upside |
| Evidence | Confirmed / Inferred / Hypothesis | Confirmed has code, test, log, issue, or repro evidence |
| Scope | S / M / L | Prefer S or M; split L into slices |
| Urgency | Now / Next / Later | Separate urgent risk from merely interesting ideas |
| Confidence | High / Medium / Low | Confidence in both the problem and proposed first slice |
| Novelty | Routine / Creative / Bet | Use Bet for outside-the-box ideas that need a spike |

Priority heuristic:

- `P0`: high impact plus urgent risk, especially security, data loss, or
  production breakage.
- `P1`: high impact with confirmed or strongly inferred evidence.
- `P2`: medium impact, maintainability drag, missing coverage, or promising
  product improvement.
- `P3`: speculative idea, polish, or future option.

## Lenses

### Correctness And Reliability

- Unhandled errors, retries, timeout behavior, cancellation, and partial failure
  states.
- Race conditions, idempotency, duplicate submissions, and concurrent updates.
- Data validation at boundaries: API input, DB writes, queues, webhooks, file
  imports, and external service callbacks.
- State recovery after crashes, deploys, or interrupted jobs.

### Product And User Journey

- Repeated steps that could be collapsed, automated, or remembered.
- Empty states, onboarding gaps, unclear errors, and workflows that lack next
  actions.
- High-value user journeys that have no tests or observability.
- Features implied by existing data models but absent from the UI or API.

### Architecture And Change Velocity

- Duplicate domain logic that can drift.
- Large modules that mix unrelated responsibilities.
- Weak contracts between frontend/backend, services, jobs, and storage.
- Areas where adding one small feature requires touching many files.

### Tests And QA

- Critical flows with only happy-path coverage.
- Error cases missing from tests: invalid input, authorization failures, empty
  datasets, unavailable dependencies, rate limits, and retries.
- Tests that rely on timing, network access, global state, or order dependence.
- Fixtures that are stale, too broad, or disconnected from production-like
  contracts.

### Security And Privacy

- Authentication, authorization, tenant isolation, secret handling, file uploads,
  webhooks, SSRF, injection, XSS, CSRF, prompt injection, and dependency
  supply-chain risks.
- Logs or telemetry that might leak secrets or personal data.
- Admin/debug routes or scripts without clear guardrails.

### Performance, Cost, And Scale

- N+1 queries, unbounded loops, missing pagination, large client bundles,
  expensive polling, and redundant external calls.
- Cache invalidation gaps, stale data risks, and operations that grow with total
  history instead of recent scope.
- Background jobs without backpressure, batching, or retry budgets.

### Observability And Operations

- Missing logs, metrics, traces, alerts, dashboards, and runbooks for important
  flows.
- Errors that are swallowed or reported without enough context.
- Deploy, migration, rollback, and parity checks that are manual or easy to
  skip.

### Documentation And Onboarding

- Setup docs that omit prerequisites, environment variables, seed data, or
  common failure modes.
- Architecture docs that do not match current code.
- Missing "read when" hints for agent-readable docs.
- Repeated project knowledge living only in conversations or issue comments.

### Developer Experience

- Slow or flaky local commands.
- Inconsistent package scripts, lint rules, generated artifacts, or environment
  setup.
- Missing scaffolds for common feature/test patterns.
- Confusing errors from scripts that could preflight dependencies.

### Novel Opportunity

Use these prompts to find ideas beyond obvious fixes:

- What hidden product is already implied by the data models, logs, fixtures, or
  tests?
- Which manual operator action could become a safe button, workflow, or
  automation?
- What one small internal tool would reduce repeated agent or developer work?
- What would become possible if every critical workflow emitted structured
  events?
- Which integration boundary could expose a reusable public API or plugin point?
- What assumption in the current architecture most limits future product
  options?
- What cheap experiment could validate a much larger idea without committing to
  the full build?

Novel ideas should usually become `spike` or `exploration` issues unless the
evidence is already strong.

## Issue Body Templates

### Bug

```markdown
## Problem

Describe the broken behavior and who it affects.

## Evidence

- `path/to/file.ts`: what the code shows
- Command/log/repro: what was observed

## Expected Behavior

Describe the intended behavior.

## Proposed Scope

Smallest useful fix.

## Acceptance Criteria

- [ ] Failing case is covered by a test
- [ ] Behavior is fixed for the named scenario
- [ ] Existing happy path still passes

## Risks / Open Questions

List unknowns or dependencies.
```

### Improvement

```markdown
## Why Now

Describe the user, business, operational, or developer pain.

## Current Signals

- Code/docs/issues that support this opportunity

## Proposal

Small first slice.

## Acceptance Criteria

- [ ] Outcome is visible or measurable
- [ ] Existing workflow remains supported
- [ ] Docs/tests are updated if behavior changes

## Risks / Open Questions

List unknowns or follow-up decisions.
```

### Spike

```markdown
## Question

State the unknown this spike should answer.

## Context

Why the question matters and what evidence led here.

## Investigation Plan

- [ ] Inspect relevant code/docs/data
- [ ] Prototype or benchmark only if needed
- [ ] Recommend build/no-build/next-slice

## Deliverable

Short written recommendation with links to evidence.
```
