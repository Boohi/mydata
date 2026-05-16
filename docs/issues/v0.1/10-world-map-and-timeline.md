---
title: "World Map view + Timeline view"
labels: ["type:slice", "priority:p1", "area:ui"]
milestone: "v0.1"
---

## Goal

World choropleth of bytes per country (with hover breakdown) and a 24h stacked-by-app timeline.

## Why

Spec §3 — the "oh shit, look where my data is going" moments.

## Scope

In:
- `react-simple-maps` choropleth, color scale by bytes (log).
- Hover panel: country → top apps + top hostnames.
- Timeline: visx stacked area, 5-minute buckets over 24h, stacked by top-N apps + "other".
- Query layer in `apps/ui/src/queries/`.

Out:
- Cross-filtering between views (post-v0.1 polish).

## Dependencies

- #9 (query layer pattern established).

## Acceptance criteria

- [ ] Map renders cleanly at multiple window sizes.
- [ ] Hover panel shows accurate top-3 apps per country.
- [ ] Timeline renders without console errors on a fixture DB.
