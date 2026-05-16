---
title: "NEDNSProxyProvider: DNS query capture + pipe to daemon"
labels: ["type:slice", "priority:p2", "area:extension", "area:daemon"]
milestone: "v0.1"
---

## Goal

Add `NEDNSProxyProvider` to the extension and stream DNS queries (name, type, resolved IPs) over the existing XPC pipe.

## Why

Hostname attribution makes destinations human-readable ("amazonaws.com" instead of `54.x.x.x`). Per spec §4.1.

## Scope

In:
- `NEDNSProxyProvider` subclass that proxies queries transparently and logs each.
- New message types `dnsQueried` on the XPC pipe.
- Daemon-side handler that logs to stdout (storage is #6).
- Entitlement: `com.apple.developer.networking.networkextension` with `dns-proxy`.

Out:
- Joining DNS to flows (issue #7 — enrichment).
- DNS caching policy (post-v0.1).

## Dependencies

- #4 (XPC pipe exists).

## Acceptance criteria

- [ ] `dig example.com` produces a `dnsQueried` event in daemon stdout.
- [ ] Performance: extension overhead on DNS resolution under 5ms median in a microbenchmark.
- [ ] Entitlement documented in `docs/build.md`.
