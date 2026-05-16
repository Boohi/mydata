---
title: "Reverse-DNS fallback enrichment when DNS join misses"
labels: ["type:slice", "priority:p3", "area:daemon", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Perform a reverse-DNS lookup for flow destination IPs that did not match any cached DNS query within the join window, improving hostname attribution coverage.

## Why

The DNS-flow join has a 5-second window and same-process constraint. Flows that miss it show only a raw IP. Reverse DNS provides a best-effort fallback without requiring MITM.

## Scope

In:
- Daemon-side reverse-DNS resolver triggered for flows with null `hostname` after enrichment.
- Rate-limited to avoid hammering local resolver.
- Results cached with a TTL.
- Reverse-DNS hostname clearly distinguished in UI from forward-DNS-joined hostnames.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
