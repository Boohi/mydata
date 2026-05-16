---
title: "Repo tooling: monorepo build scripts, lint, format, typecheck, CI skeleton"
labels: ["type:slice", "priority:p1", "area:ci"]
milestone: "v0.1"
---

## Goal

Set up the monorepo build/lint/test/format scaffolding (npm workspaces for UI + packages, Swift packages for extension/daemon) and a CI workflow that runs them on every PR.

## Why

Every subsequent slice depends on a working `npm run lint`, `npm run typecheck`, `npm test`, `swift test`, and CI gating. See spec §4 (architecture) and §7 (testing).

## Scope

In:
- Root `package.json` with npm workspaces for `apps/ui` and `packages/*`.
- `apps/ui/` Vite + Tauri 2 init (no app logic yet — empty React app rendering "mydata").
- ESLint + Prettier shared configs.
- TypeScript root config.
- `Package.swift` skeletons in `apps/extension` and `apps/daemon`.
- `.github/workflows/ci.yml` that runs: lint, typecheck, npm test, `swift test` for both Swift packages, format check.

Out:
- Any actual product logic.
- Signing or notarization (issue #11).
- Privacy paranoia test (issue #12).

## Dependencies

- none (this is the first code-bearing slice).

## Acceptance criteria

- [ ] `npm install` from a fresh clone succeeds.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check` all pass.
- [ ] `swift test --package-path apps/extension` and `swift test --package-path apps/daemon` pass (empty test suites are fine).
- [ ] CI runs all checks on PR and on push to main.
- [ ] CI is green on a no-op PR.

## Notes

Pin Tauri to 2.x. Pin Node to 20.x via `.nvmrc`. Swift toolchain pinned via `.swift-version`.
