---
title: "Packaging: sign, notarize, .dmg, release CI workflow"
labels: ["type:slice", "priority:p1", "area:packaging", "risk:signing"]
milestone: "v0.1"
---

## Goal

Produce a signed + notarized `.dmg` from CI on a git tag and attach it to a GitHub Release.

## Why

The whole product is a download. Spec §3 (signed + notarized .dmg distribution).

## Scope

In:
- `scripts/sign.sh` (Developer ID Application + system extension entitlement).
- `scripts/notarize.sh` wrapping `xcrun notarytool submit` + `stapler staple`.
- `create-dmg` configuration producing a branded DMG.
- `.github/workflows/release.yml`: on tag `v*`, build, sign, notarize, attach to Release.
- Apple credentials in GitHub Secrets: `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_CERT_P12`, `APPLE_CERT_PASSWORD`. Documented in `docs/build.md`.

Out:
- Auto-update mechanism (post-v0.1; would require network access — must be designed against the privacy promise carefully).

## Dependencies

- #11 (everything implemented).

## Acceptance criteria

- [ ] Tagging `v0.1.0-rc1` produces a notarized `.dmg` attached to a draft release.
- [ ] `xcrun stapler validate` passes on the downloaded artifact.
- [ ] Fresh-Mac install from the .dmg works end to end.
