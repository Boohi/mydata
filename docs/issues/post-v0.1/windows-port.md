---
title: "Windows port via WFP (Windows Filtering Platform)"
labels: ["type:slice", "priority:p3", "area:extension", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Port the network capture layer to Windows using the Windows Filtering Platform (WFP) kernel-level API.

## Why

Windows has a large user base and represents a major market expansion. WFP provides equivalent kernel-level per-flow visibility to macOS NEFilterDataProvider.

## Scope

In:
- WFP-based flow capture driver or user-space callout.
- Windows daemon equivalent receiving flow events.
- CI pipeline additions for Windows builds.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
