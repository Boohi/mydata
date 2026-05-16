---
title: "Browser extension companion: per-tab attribution"
labels: ["type:slice", "priority:p3", "area:ui", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Provide a browser extension that maps network flows to the active browser tab URL, enabling per-site rather than per-process attribution.

## Why

The macOS network extension can only attribute flows to the browser process (e.g. Safari, Chrome). Tab-level granularity requires cooperation from the browser side via a companion extension.

## Scope

In:
- Browser extension (Chrome/Firefox/Safari) that sends tab URL changes to the mydata daemon via a local HTTP endpoint or native messaging.
- Daemon correlates tab URL with flows by timestamp + process.
- UI shows per-site breakdown within browser app entries.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
