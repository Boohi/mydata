---
title: "Payload-size-based content-type heuristics (no MITM)"
labels: ["type:slice", "priority:p3", "area:daemon", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Infer likely content type (video stream, small API call, telemetry ping, large upload, etc.) from payload size patterns without decrypting or intercepting traffic content.

## Why

"Chrome sent 50 MB to doubleclick.net" is more actionable than "Chrome sent 50 MB." Size-based heuristics add context without any MITM or privacy violation.

## Scope

In:
- Daemon-side heuristic classifier using byte counts and flow duration to bucket flows (e.g., stream, bulk-upload, small-api, telemetry-ping).
- Classifier rules defined in a versioned config file.
- UI shows inferred content type as a tag on flow rows.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
