# Build the feedback loop

Choose the cheapest runnable check that reaches the actual failure: an existing
test, HTTP request, CLI fixture, browser flow, recorded event replay, isolated
harness, or controlled comparison between known states. Use project-owned test
data. Establish a specific failure assertion rather than only checking startup
or an error-free process exit.

Reading code and runtime configuration to construct this check is part of
diagnosis. Avoid committing to a fix before evidence distinguishes plausible
causes. When a bug is obvious and the failing test already captures it, use that
test directly instead of performing ceremonial extra phases.

## Tighten without changing the bug

Reduce setup time, pin clocks and random seeds, isolate data, and cut irrelevant
inputs one at a time. Re-run after each reduction to confirm the original symptom
remains. Preserve the original reproduction so the final fix can be checked
against it, not only the minimized test.

For intermittent failures, report the observed failure rate and sample size.
Use bounded repeated trials or controlled stress to improve reproducibility;
keep the environment and seed comparable before and after the fix. Do not turn
a flaky run green by weakening the assertion or retrying away the failure.

For performance regressions, measure a baseline and the same workload after the
change. Use a profiler, query plan, or timing harness to distinguish hypotheses;
account for noise rather than interpreting a single faster run as proof.

## Probe and preserve

Each probe needs a prediction and a result. Prefer debugger inspection or a
focused measurement; tag temporary logs with a task-specific marker. Avoid
capturing authentication headers, secrets, personal data, or full request dumps
when a redacted field carries the signal. Remove only this task's temporary
instrumentation. Preserve existing logs, fixtures, and another worker's changes.

## Inaccessible runtime

Check current local and configured remote capabilities before declaring a gate.
Record exact command failures separately from the reported product failure.
If a device, provider, permission, dataset, or trace is still missing, name that
specific evidence and the smallest next step. A human step belongs only where
the agent cannot complete it with available authority and tools; prepare the
necessary command or capture instructions first.

When no test interface can express the bug, document the architectural limitation
and retain the reproduction. File a bounded interface improvement when justified;
do not fabricate a regression test that cannot detect the actual failure.

Adapted from Matt Pocock's `diagnosing-bugs`; see
[upstream notice](upstream-notice.md).
