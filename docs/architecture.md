# Architecture

This is a living doc. The authoritative initial design is `docs/superpowers/specs/2026-05-16-mydata-v0.1-design.md`.

## Components

mydata splits into three processes, each with one clear responsibility:

### Network extension (`apps/extension`, Swift)

- Single target with both `NEFilterDataProvider` (per-flow metadata, byte counters) and `NEDNSProxyProvider` (DNS query log).
- Emits structured flow events only — no allow/block decisions in v0.1; every verdict is `.allow`.
- Communicates with the daemon via XPC. Buffers locally if the daemon is down.
- Minimal logic. The extension is the most security-sensitive surface; we keep it as small and auditable as possible.

### Daemon (`apps/daemon`, Swift, launchd LaunchAgent)

- Receives flow + DNS events from the extension via XPC.
- Enriches each event:
  - Process attribution: `audit_token` → PID → bundle ID, executable path, app icon (cached).
  - Remote endpoint: IP → country (DB-IP Lite Country), IP → ASN + org (DB-IP Lite ASN), IP → reverse DNS (cached).
  - Joins flows to recent DNS lookups (same process + same destination IP) to attach a hostname when one was resolved.
- Batches and writes to SQLite at `~/Library/Application Support/mydata/events.db`.
- Sweeper task enforces the retention window (default 30 days, user-configurable).
- Exposes a read-only XPC endpoint for the UI to subscribe to "new flow" events for live updates.

### UI (`apps/ui`, Tauri 2 + React + TypeScript + Vite)

- Tauri 2 (Rust shell, WKWebView). ~10 MB shell vs ~100 MB Electron.
- Tray icon shows live bytes/sec; click reveals menu (open dashboard, pause, quit).
- Main window views:
  - **Today** — top destinations by bytes, top apps, top countries (cards + bars).
  - **World Map** — choropleth of bytes per country, hover for breakdown (`react-simple-maps` + `visx`).
  - **Apps** — per-app drilldown, sankey of app → destination → country (`visx` sankey).
  - **Timeline** — last 24h byte rate, stacked by app.
  - **Settings** — retention window, exclude list, pause toggle, export DB, about / license / privacy promise.
- Reads SQLite read-only via `tauri-plugin-sql`. Subscribes to daemon XPC for live updates.

## Why this split

- The system extension is intentionally tiny so it is easy to audit. The privacy audience will read this code.
- The daemon owns enrichment + storage so the extension stays minimal.
- Tauri's UI is portable: when we later add Windows (WFP) or Linux (eBPF/netfilter) backends, only the extension + daemon swap; the entire React UI is reused.

## Extension ↔ Daemon IPC

The extension is a client; the daemon is a server. Transport is a Unix
domain socket at `~/Library/Application Support/mydata/daemon.sock`. The
wire format above the transport is documented in
[`packages/schema/ipc.md`](../packages/schema/ipc.md) and implemented by the
`MydataIPC` Swift package.

Reconnect: on failure, the extension's `IPCClient` reconnects with
exponential backoff capped at 5 seconds. Lost messages during the gap are
acceptable in v0.1 — we trade durability for simplicity.

Liveness: the daemon will accept `ping` frames and reply with `pong`. Not
exercised in v0.1 but the codec already handles them.

## Privacy invariants

See `docs/privacy-promise.md`. The extension/daemon pair has zero outbound
network calls; the privacy-paranoia harness enforces this in CI.
