# Privacy Promise

mydata exists to help you see where your data goes. It would be ironic — and disqualifying — if the tool itself leaked data. This document is the promise. Every item is enforced either by code or by review.

## What we guarantee

1. **Zero outbound network calls.** The app, the daemon, and the system extension never connect to a remote server. There is no telemetry, no crash reporting service, no analytics, no auto-update phone-home in v0.1. Enforced by `tests/privacy-paranoia.test.ts` running in CI on every PR.
2. **All data stays on your Mac.** The SQLite database lives at `~/Library/Application Support/mydata/events.db` and is never transmitted off-device by us.
3. **No payload inspection.** We never install a root CA and we never decrypt your traffic. We only see flow metadata (process, remote address, byte counts, DNS query names).
4. **GeoIP data is bundled, not fetched.** We do not make geo lookups against a remote service. The DB-IP Lite database ships with the app.
5. **Open source under AGPL-3.0.** You can read and audit every line. Any fork must keep these guarantees or it cannot be called mydata.

## What we collect locally

- Per-flow metadata: process bundle ID, executable path, protocol, local port, remote IP, remote port, hostname (if a DNS lookup resolved it), bytes in, bytes out, start and end timestamps.
- DNS queries: process bundle ID, query name, query type, resolved IPs, timestamp.
- Enriched derived fields: country code, ASN, ASN organization.
- A randomly generated local install ID (used only to make exported diagnostics correlatable; never transmitted).

## What we never collect

- HTTPS payload bodies.
- Window titles, URLs visited inside a browser, page content.
- Any data from other apps' private storage.

## How to verify

- Read the source: <https://github.com/Boohi/mydata>.
- Run the privacy paranoia test yourself: `npm run test:privacy`.
- Use Little Snitch or LuLu to confirm mydata makes no outbound connections.
- Inspect your `~/Library/Application Support/mydata/events.db` directly with the `sqlite3` CLI — it is your data.

## How to revoke

- Quit the app.
- Remove the system extension via System Settings → General → Login Items & Extensions.
- Delete `~/Library/Application Support/mydata/`.
- Drag the app from `/Applications` to the Trash.

Nothing of yours remains, because nothing of yours ever left.
