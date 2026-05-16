---
title: "Today view + Apps drilldown"
labels: ["type:slice", "priority:p1", "area:ui"]
milestone: "v0.1"
---

## Goal

Implement the **Today** view (top destinations / top apps / top countries by bytes for the last 24h) and the **Apps** drilldown (per-app sankey: app → destination → country).

## Why

These are the two most-used views per spec §3.

## Scope

In:
- `Today` view: three ranked lists with bytes and counts.
- `Apps` view: sortable app list, click to open per-app sankey using `visx`.
- Time-range chip: 1h / 24h / 7d / 30d.
- SQL queries live in `apps/ui/src/queries/` with tests against a fixture DB.

Out:
- World Map (#10).
- Timeline (#10).

## Dependencies

- #7 (enrichment), #8 (shell).

## Acceptance criteria

- [ ] On a fixture DB with 10k rows, Today renders in under 200ms.
- [ ] Sankey nodes are clickable and filter the underlying app's list.
- [ ] Vitest covers the query layer.
