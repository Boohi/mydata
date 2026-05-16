---
title: "Network Extension skeleton: NEFilterDataProvider + entitlements + dev signing"
labels: ["type:slice", "priority:p1", "area:extension", "risk:signing"]
milestone: "v0.1"
---

## Goal

Stand up the Swift system extension target with `NEFilterDataProvider`, request the Network Extension entitlement, and get it loading in dev mode against a personal Developer Team.

## Why

The extension is the primary data source. Everything downstream depends on it producing flow events. See spec §4.1 (Network extension component).

## Scope

In:
- `apps/extension/` Swift package that builds a `.systemextension`.
- `NEFilterDataProvider` subclass that allows all flows (no blocking) and logs each flow start/end with placeholder fields.
- Entitlements file: `com.apple.developer.networking.networkextension` with `content-filter-provider`.
- `Info.plist` for system extension.
- Dev signing helper script `scripts/sign.sh` (reads Team ID from `scripts/signing.env`, which is gitignored).
- Manual loading instructions in `docs/build.md`.

Out:
- DNS proxy provider (issue #5).
- XPC pipe to daemon (issue #4).
- Persistence (issue #6).
- Notarization (issue #11).

## Dependencies

- #1 (build scripts in place).

## Acceptance criteria

- [ ] `swift build --package-path apps/extension` succeeds.
- [ ] The extension can be loaded via `systemextensionsctl` in dev mode.
- [ ] Triggering a normal browser network call produces a log line in Console.app from the extension.
- [ ] `docs/build.md` has step-by-step extension load instructions.
