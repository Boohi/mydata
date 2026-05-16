# apps/extension

The mydata Network Extension. A `NEFilterDataProvider` subclass that:

- Observes every outbound flow on the Mac.
- Returns `.allow` for every flow (no blocking in v0.1 — see AGENTS.md).
- Emits one `os_log` line per flow start to subsystem `io.mydata.extension`,
  category `filter`.

All enrichment (GeoIP, ASN, process attribution) happens in the daemon
(`apps/daemon`), not here. Audit-friendliness over convenience.

## Layout

- `Sources/MydataExtension/` — Swift sources (the provider + `FlowEvent`).
- `Tests/MydataExtensionTests/` — XCTest unit tests.
- `Bundle/Info.plist` — system-extension Info.plist.
- `Bundle/MydataExtension.entitlements` — Network Extension entitlement.

## Build

```bash
swift build --package-path apps/extension
swift test  --package-path apps/extension
```

## Loading in dev

See `docs/build.md` § "Loading the extension in dev mode".
