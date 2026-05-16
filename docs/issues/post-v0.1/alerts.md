---
title: "Anomaly alerts: new country / new ASN destinations"
labels: ["type:slice", "priority:p3", "area:daemon", "area:ui", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Notify the user when a new country or ASN destination is first seen for an app, surfacing unexpected or suspicious network activity.

## Why

Passive monitoring only catches anomalies if the user happens to be looking. Proactive alerts dramatically raise the value of the tool for privacy-conscious users.

## Scope

In:
- Daemon tracks per-app seen-country and seen-ASN sets in the DB.
- Alert trigger when a first-time (app, country) or (app, ASN) pair is observed.
- macOS UserNotification shown with app name, destination, and "View in mydata" action.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
