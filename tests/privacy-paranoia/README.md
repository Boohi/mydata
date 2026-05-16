# Privacy Paranoia Test

This directory holds the executable enforcement of the privacy promise in `../../docs/privacy-promise.md`.

## What it does

For every binary mydata ships, the harness:

1. Verifies the sandbox (a Linux network namespace via `unshare -rn`) actually blocks outbound traffic by running a known-bad fixture talker and asserting it cannot connect. If the sandbox is broken, the test fails fast — we will never silently green-light a binary in an unsealed sandbox.
2. Launches each registered binary inside that sandbox.
3. Asserts the binary did not report a successful connection (we grep for the `CONNECTED` sentinel that the fixture would have printed and check exit conditions).

## Running locally

```bash
npm run test:privacy
```

- On Linux: full enforcement runs.
- On macOS / Windows: harness runs in advisory mode (`unshare` is Linux-only). For real verification, push and let CI run it. Mac users wanting parity can use Little Snitch or LuLu to confirm none of the binaries make outbound calls during normal operation.

## Adding a binary

When a slice produces a new binary (e.g. `apps/daemon/.build/release/mydata-daemon`), add it to `binaries.json`:

```json
{
  "version": 1,
  "binaries": [{ "path": "apps/daemon/.build/release/mydata-daemon", "args": ["--check"] }]
}
```

The CI job will then exercise it.

## Bypass procedure (post-v0.1 opt-in network features)

If a future feature genuinely needs outbound network access (e.g. optional cloud sync), it must:

1. Live in a separate process binary that is **not** registered here.
2. Be off by default and require an explicit user opt-in.
3. Have its own dedicated test that asserts the opt-in is required, that no traffic flows when off, and that the user's choice is persisted.
4. Be reviewed under the `risk:privacy` label by at least two maintainers.

The default-mydata binaries (extension + daemon + UI shell) remain registered here and must continue to make zero outbound calls.
