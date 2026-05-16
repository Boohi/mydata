---
title: "Settings: retention, exclusions, pause toggle, export"
labels: ["type:slice", "priority:p2", "area:ui", "area:daemon"]
milestone: "v0.1"
---

## Goal

Add user-facing controls for the retention window, exclusion list, pause/resume monitoring, and exporting the SQLite DB.

## Why

Spec §3 (MVP scope). Pause is a load-bearing trust feature — privacy users need a kill switch.

## Scope

In:
- Settings panel in UI with retention slider (1–365 days), exclusion list editor (CIDR / hostname patterns), pause toggle, "Export DB" button.
- Daemon: respect pause flag (stop writing to SQLite while paused; extension still allows traffic).
- Daemon: respect exclusions (drop matching events at write time, log a counter).
- Export DB action: copies the file to a user-chosen location atomically.

Out:
- Per-app exclusion (post-v0.1 nice-to-have).

## Dependencies

- #8 (shell), #7 (enrichment), #6 (DB).

## Acceptance criteria

- [ ] Pause toggle is reflected in daemon within 1 second.
- [ ] Adding an exclusion immediately stops new matching flows from being persisted.
- [ ] Exported DB opens cleanly in `sqlite3` CLI.
- [ ] Retention slider value persists across restarts.
