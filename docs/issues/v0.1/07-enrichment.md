---
title: "Enrichment: GeoIP country, ASN, process attribution, DNS-flow join"
labels: ["type:slice", "priority:p1", "area:daemon"]
milestone: "v0.1"
---

## Goal

Populate `country_code`, `asn`, `asn_org`, `hostname`, `bundle_id`, `executable_path`, and app `display_name` + `icon_blob` on each flow row.

## Why

Without enrichment, the UI shows "53.x.x.x to ??" — useless. Spec §4.1.

## Scope

In:
- `packages/geoip-data/` bundles DB-IP Lite (Country + ASN) under CC-BY-4.0 with a script that downloads the latest at build time.
- Daemon-side enricher resolves IP → country, IP → ASN+org synchronously on flow-end.
- Process attribution: capture `audit_token` in the extension, resolve PID → bundle ID + executable + icon in the daemon, cache by PID.
- DNS-flow join: within the last 5s, match same-process same-IP DNS resolution to attach `hostname`.

Out:
- Reverse-DNS fallback (post-v0.1).
- Periodic GeoIP refresh (post-v0.1; ships fresh per release).

## Dependencies

- #6 (DB exists), #5 (DNS exists).

## Acceptance criteria

- [ ] Fixture test: known IPs resolve to known country/ASN with golden assertions.
- [ ] App icon caching: re-resolving same bundle ID does not re-read the bundle.
- [ ] At least 95% of flows in a normal browsing session get a non-null `hostname`.
- [ ] License attribution for DB-IP Lite added to README and About screen.
