---
title: "iOS companion app (read-only view of paired Mac)"
labels: ["type:slice", "priority:p3", "area:ui", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Build an iOS app that shows a read-only view of a paired Mac's network activity over a local network connection.

## Why

Users want to glance at their Mac's network activity from their phone. The pairing is local-only (no cloud) to preserve the privacy promise.

## Scope

In:
- Local-network Bonjour discovery between Mac daemon and iOS app.
- Read-only view of Today and Apps data streamed from daemon over local socket.
- No cloud relay — pairing works only on the same Wi-Fi network.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
