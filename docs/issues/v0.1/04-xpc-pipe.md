---
title: "Daemon skeleton + XPC pipe from extension to daemon"
labels: ["type:slice", "priority:p1", "area:daemon", "area:extension"]
milestone: "v0.1"
---

## Goal

Create the Swift daemon (launchd LaunchAgent) and wire an XPC connection so the extension delivers flow events to it.

## Why

Per spec §4.2, the extension is intentionally minimal. The daemon owns enrichment and storage. The pipe is the first integration point.

## Scope

In:
- `apps/daemon/` Swift package building a daemon binary + launchd plist.
- Versioned, length-prefixed binary message format defined in `packages/schema/ipc.md`.
- Extension side: sends `flowStarted` / `flowEnded` messages with raw fields (no enrichment).
- Daemon side: receives, deserializes, logs to stdout (storage is issue #6).
- Reconnect/backoff on either side if the other restarts.

Out:
- DNS messages (issue #5).
- SQLite writes (issue #6).
- Enrichment (issue #7).

## Dependencies

- #3 (extension exists).

## Acceptance criteria

- [ ] Launching the daemon and triggering browser traffic causes daemon stdout to print one line per flow start/end.
- [ ] Killing the daemon and restarting it: the extension reconnects within 5 seconds.
- [ ] `packages/schema/ipc.md` documents the wire format with version field.
- [ ] Unit tests for the message serializer round-trip cleanly.
