# Behavioral testing

Exercise the interface callers use. A useful test survives a refactor that
preserves behavior and fails when the requested capability breaks. Prefer an
existing integration surface reaching the failure over a new export created only
for tests; choose a smaller interface when it captures the complete behavior more
clearly. Follow repository terminology and established test conventions.

## Assertions with an independent oracle

Expected results come from the specification, a worked example, a known fixture,
or another independent source. For line items priced 10 and 5, assert 15 rather
than recomputing the sum with the same algorithm being tested. For retries, assert
the final observable outcome and error case, not only that an internal helper ran.

Read persisted output through the product's retrieval interface when available.
Direct storage inspection remains appropriate when storage format, durability,
isolation, or migration behavior is the actual contract under test. Assert call
order or count when that order or count is itself required behavior, such as
exactly-once publication; avoid incidental implementation assertions.

## Real dependencies and controlled substitutes

- Use real owned code and a project-owned test database when practical.
- Control time, randomness, network responses, and isolated filesystem inputs
  when determinism requires it. Use established test adapters rather than adding
  indirection solely to mock an internal collaborator.
- Mock external services at their real contract, including failures. A mock
  proves behavior under that contract; it does not prove a provider integration.

Prefer dependencies passed into existing interfaces over hidden construction when
it improves the actual design. Design alternatives are justified by real caller
needs or costly testing friction, not by a blanket architectural rule.

## Sensitivity and scope

Observe red for the requested symptom before implementing. Build one complete
test-to-behavior slice at a time, then refactor while green. Include a relevant
edge or error case. When changing a guard, parser, or evaluator, include a negative
control that would pass if the guard were missing; prove that it rejects.

Keep existing tests protecting independent failure modes. Remove an old test only
after identifying what replaces its coverage or why its contract no longer
applies. Avoid accumulating parallel tests that merely restate the same invariant.

For skill changes, distinguish three kinds of evidence: structural checks of
files and links, decision traces from a real model with held-out scenarios, and
observed tool/runtime behavior. Keyword tests or self-authored gold traces prove
neither model compliance nor successful delivery.

Adapted from Matt Pocock's `tdd` and `codebase-design`; see
[upstream notice](upstream-notice.md).
