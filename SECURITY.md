# Security Policy

## Scope

mydata captures, stores, and visualizes network metadata locally on the user's Mac. Security-relevant surfaces:

- The Network Extension (`apps/extension`) — runs with elevated privileges inside the system extension sandbox.
- The daemon (`apps/daemon`) — runs as the user, reads from the extension via XPC, writes to a local SQLite DB.
- The UI (`apps/ui`) — Tauri 2 webview; reads the SQLite DB.

## Reporting a vulnerability

Email **security@boohi.dev** (replace once a real address exists). Please do not file a public issue for security reports.

Include: affected component, reproduction steps, and impact. We acknowledge within 72 hours.

## Privacy promise

We make no outbound network calls from the app, daemon, or extension. A CI test enforces this. See [docs/privacy-promise.md](docs/privacy-promise.md).
