---
title: "Tauri 2 shell + tray icon + onboarding flow"
labels: ["type:slice", "priority:p1", "area:ui"]
milestone: "v0.1"
---

## Goal

Stand up the Tauri 2 app: tray icon, main window shell, and a first-launch onboarding that walks the user through approving the system extension.

## Why

Spec §4.1 (UI component) and §10 (NE approval UX is the biggest friction).

## Scope

In:
- Tauri 2 + React + Vite setup (extends #1).
- Tray icon (placeholder SVG); click opens dashboard or shows context menu (Open / Pause / Quit).
- Onboarding screens: welcome → privacy promise summary → "Approve System Extension" screen with screenshot + "Open System Settings" button → success.
- Read-only `tauri-plugin-sql` connection to events.db.
- Empty dashboard layout with the four view stubs (Today / Map / Apps / Timeline).

Out:
- Real visualizations (#9, #10).
- Settings screen (#11 in this list — see #11 issue).

## Dependencies

- #6 (DB exists so plugin-sql can open it).

## Acceptance criteria

- [ ] Fresh install: tray icon appears, click opens window.
- [ ] First launch: onboarding shown; "I've approved it" advances only after the extension is actually loaded (check via `systemextensionsctl list`).
- [ ] Playwright smoke test covers the onboarding happy path.
