# Release Checklist

Manual QA before tagging a release. Automation covers most cases; this list covers what we cannot easily script.

## Per-release

- [ ] CI green on `main` for the release commit.
- [ ] Privacy paranoia test green.
- [ ] Fresh-install flow on a clean macOS user account: install .dmg, drag to Applications, approve system extension, see flows within 60 seconds.
- [ ] Today, World Map, Apps, Timeline views render without console errors on a 14" MacBook Pro and a 27" external display.
- [ ] Tray icon updates byte rate live; pause/resume toggle works.
- [ ] Retention sweeper actually drops old rows on a DB seeded with a 31-day-old fixture.
- [ ] Exclusion list correctly hides matching flows.
- [ ] Export DB action produces a valid SQLite file.
- [ ] Notarization status: `xcrun stapler validate mydata.app` succeeds.
- [ ] `LICENSE`, `README.md`, and the in-app About page agree on the version number.
