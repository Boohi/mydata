# AGENTS.md

## Purpose

Shared briefing for coding agents working in `mydata`. Keep it short, factual, current. Durable project rules go here; tool-specific behavior only goes in tool-specific files when it cannot be shared.

## Project Snapshot

mydata is a passive, local-only macOS application that visualizes outbound network flows so users can see where their data is going by app, country, and organization.

Stack:

- Swift system extension (`apps/extension`) — `NEFilterDataProvider` + `NEDNSProxyProvider`. Captures flow + DNS events. Minimal logic.
- Swift daemon (`apps/daemon`) — XPC service. Enriches (GeoIP, ASN, process attribution), writes to local SQLite.
- Tauri 2 + React + TypeScript (`apps/ui`) — tray app, dashboard, visualizations.
- Shared SQLite schema (`packages/schema`) — single source of truth, codegen TS + Swift bindings.
- Bundled GeoIP data (`packages/geoip-data`) — DB-IP Lite, CC-BY-4.0.

All copy is English. License is AGPL-3.0.

## First Steps

- Before substantial work, read the relevant local docs instead of relying on memory.
- Use `rg` and `rg --files` for search.
- Inspect existing patterns before adding new abstractions.
- Do not edit generated output, third-party vendored code, or `node_modules`.
- Never commit secrets (Apple Developer credentials, notarization keys, GitHub tokens).
- Use non-destructive git workflows. Do not discard user changes unless the user explicitly asks.

## Local Setup

- Install dependencies: `npm install` (UI), `swift package resolve` (extension + daemon).
- macOS 13+ required for development.
- Apple Developer account required for system extension signing in dev mode.
- See `docs/build.md` for the full first-time setup including entitlements and certificate provisioning.

## Programmatic Checks

Run focused checks during development, then run the broader relevant checks before handing off:

- Lint (UI): `npm run lint`
- Typecheck (UI): `npm run typecheck`
- Tests (UI): `npm test`
- Native e2e smoke: `npm run test:e2e`
- Tests (Swift): `swift test --package-path apps/extension` and `swift test --package-path apps/daemon`
- Format check: `npm run format:check`
- Privacy paranoia test: `npm run test:privacy` (MUST pass before any PR merges)

If you cannot run a relevant check, state why and what risk remains.

## Browser Automation

- Use `agent-browser` as the default for ad hoc browser work, local app
  verification, screenshots, page inspection, clicking, typing, and exploratory
  UI QA.
- Use Playwright for committed e2e suites and CI regression coverage.
- Use Playwright MCP only as fallback when `agent-browser` is unavailable or the
  task specifically requires the MCP browser surface.

## Project Map

- `apps/extension/` — Swift system extension (Network Extension + DNS proxy).
- `apps/daemon/` — Swift XPC service, SQLite writer, enrichment.
- `apps/ui/` — Tauri 2 + React + Vite. Visualizations in `visx` and `react-simple-maps`.
- `packages/schema/` — shared SQLite schema + TS + Swift bindings (codegen).
- `packages/geoip-data/` — bundled DB-IP Lite GeoIP + ASN databases.
- `docs/` — privacy promise, architecture, build, QA, GitHub policy, specs, plans, issue bodies.
- `scripts/` — sign, notarize, dev-extension, seed-issues, setup-labels.
- `tests/` — privacy paranoia, native e2e smoke, end-to-end loopback talker.
- `.github/` — workflows, issue/PR templates, declarative labels.

## Docs To Read

- `README.md` — human quickstart.
- `docs/superpowers/specs/2026-05-16-mydata-v0.1-design.md` — v0.1 design spec (authoritative).
- `docs/architecture.md` — living architecture doc.
- `docs/privacy-promise.md` — load-bearing privacy guarantees (a PR that violates these is a P0 bug).
- `docs/build.md` — building, signing, notarizing from source.
- `docs/github-project-management.md` — issue, label, milestone, board policy.
- `docs/qa/release-checklist.md` — manual QA before a release.

Docs are living project policy. Update them when behavior or operational expectations change.

## Privacy Rules (load-bearing)

These rules are P0. A PR that violates any of them must not merge.

- The app, daemon, and extension make zero outbound network calls. Enforced by `tests/privacy-paranoia.test.ts` in CI.
- GeoIP and ASN data are bundled at build time. No runtime fetches.
- No telemetry, no crash reporting service, no analytics, no auto-update phone-home in v0.1.
- The SQLite database stays under `~/Library/Application Support/mydata/` and is never transmitted off-device.
- If a future feature genuinely needs network access (e.g. optional cloud sync), it ships behind an explicit user opt-in with a separate process boundary, and the privacy paranoia test is updated to assert the default-off behavior.

## Network Extension Rules

- The extension is intentionally minimal. Audit-friendly is more important than convenient.
- The extension never makes blocking decisions in v0.1. Every verdict is `.allow`.
- All enrichment (GeoIP, ASN, process attribution) happens in the daemon, not the extension.
- XPC framing between extension and daemon uses a versioned, length-prefixed binary message format defined in `packages/schema/ipc.md`.

## Daemon Rules

- One writer to SQLite. All other consumers read-only.
- Schema migrations are forward-only and stored in `packages/schema/migrations/`.
- Retention sweeper runs every 10 minutes by default and is configurable.
- No long-lived in-memory caches that exceed 50 MB; spill to SQLite.

## UI Rules

- Tauri 2 only. No Electron. No standalone web build.
- Read-only access to the SQLite DB (`tauri-plugin-sql` with read-only flag).
- All visualization libraries pinned. Adding a new viz dependency requires its own slice.
- No remote fonts, no remote images, no CDNs. Everything bundled.

## GitHub And Planning

GitHub issues, milestones, labels, and the project board are the canonical executable work tracker. Docs explain policy and context.

When working from an issue:

- Read the issue body, labels, milestone, and linked docs first.
- Keep the PR scope narrow and tied to one issue.
- Update docs or the issue body when the implementation changes the plan.
- Mention which checks were run in the PR description.

For picking up the next piece of work, use the `next-slice` skill.
