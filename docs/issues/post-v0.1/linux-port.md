---
title: "Linux port via eBPF / nftables"
labels: ["type:slice", "priority:p3", "area:extension", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Port the network capture layer to Linux using eBPF socket filters or nftables with NFLOG targets to capture per-flow events.

## Why

Linux power users and developers are a strong secondary audience who would benefit from the same visibility mydata provides on macOS.

## Scope

In:
- eBPF program or nftables rules capturing per-flow metadata (process, remote IP/port, bytes).
- Linux daemon receiving and processing flow events.
- CI pipeline additions for Linux builds and tests.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
