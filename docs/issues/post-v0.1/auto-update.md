---
title: "Auto-update with privacy-preserving design"
labels: ["type:slice", "priority:p3", "area:packaging", "risk:privacy", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Implement an auto-update mechanism that delivers security patches without requiring manual reinstalls, while strictly preserving the privacy promise (no telemetry, minimal server contact, user consent required).

## Why

Manual updates are a barrier to adoption and mean security patches reach users slowly. However, auto-update requires network access, which must be designed carefully to not violate the privacy promise.

## Scope

In:
- Sparkle 2 (or equivalent) update framework with EdDSA signature verification.
- Update check is opt-in and user-initiated by default; background checks require explicit consent.
- No telemetry or device identifiers sent during update checks.
- Privacy review of update protocol documented before shipping.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
