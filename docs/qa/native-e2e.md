---
title: "Native e2e smoke"
summary: "How to run the synthetic native smoke harness for the Tauri shell, Swift IPC package, daemon, and extension."
read_when: "Running or debugging Mydata native e2e checks, CI artifacts, or issue #38 follow-up work."
---

# Native E2E Smoke

The native e2e smoke is a synthetic launch-oriented harness for issue #38.

Run locally:

```bash
npm run test:e2e
```

Local Linux agents without Swift skip Swift package checks with explicit report reasons. macOS CI runs the required lane:

```bash
npm run test:e2e:native -- --report test-results/e2e/native-smoke.json
```

The harness:

- Parses the Tauri shell config without launching a signed app.
- Runs Swift IPC, daemon, and extension package tests when Swift is available.
- Writes `test-results/e2e/native-smoke.json`.
- Records the Tauri window launch as skipped until issue #21 provides a signed shell/onboarding path suitable for CI.
- Uses only synthetic checks. It does not collect personal traffic, read real env files, or write sensitive artifacts.
