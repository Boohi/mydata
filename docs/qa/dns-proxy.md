---
title: "DNS proxy source verification and signed runtime gates"
summary: "Tests and acceptance boundaries for the original-flow DNS proxy candidate in issue 18."
read_when: "Reviewing PR 35, testing DNS relay behavior, or preparing signed macOS acceptance."
---

# DNS proxy verification

Issue [#18](https://github.com/Boohi/mydata/issues/18) and
[PR #35](https://github.com/Boohi/mydata/pull/35) retain the DNS capture work.
This candidate is not approved for installation or release. The existing
DNS-forwarding exception conflicts with the literal zero-outbound rule in
`AGENTS.md` and the product privacy promise. That product decision remains open;
these source changes do not authorize or settle it.

## Source behavior

- Startup creates no upstream connection. An accepted flow may connect only to
  its original numeric endpoint, original nonzero port, and original transport.
  Resolver names and invalid ports have no fallback.
- TCP has one persistent upstream connection and independent request/response
  pumps. Partial reads, split two-byte lengths, coalesced messages, and pipelined
  responses do not change the forwarded byte stream. A client half-close allows
  pending response bytes to drain. A transport error closes the affected flow;
  returning `false` from Apple's `handleNewFlow` also discards a flow and must
  never be described as pass-through.
- Metadata framing retains at most one 65,535-byte message per direction.
  Response parsing bounds name expansion, compression traversal, record counts,
  CNAME traversal, and resolved-address count. Unsafe metadata is suppressed;
  this never supplies or modifies the forwarding bytes.
- At most 128 requests are correlated per TCP flow. Reused outstanding IDs or
  overflow disable metadata observation for that flow. ID and question
  name/type/class must match; out-of-order responses are supported.
- UDP retains at most 64 concurrent original-datagram exchanges per flow and
  pauses further reads while full. Each exchange has a 15-second deadline, swept once per second by one session timer; a
  timed-out exchange produces no fabricated response. A transport error closes
  its affected flow. TCP and UDP sessions expire after 30 seconds without byte
  activity (checked every five seconds for TCP and every second for UDP). Stop cancels retained sessions.
- Local IPC has one in-flight send and at most 256 pending metadata events.
  A daemon outage may drop metadata but does not pause DNS forwarding. No DNS
  names or addresses are sent anywhere except the original user-requested DNS
  traffic and the local daemon socket.
- The additive IPC response type preserves old query frames. Storage distinguishes
  query and response events; see [IPC format](../../packages/schema/ipc.md).

## Automated source checks

Run with the repository's Node 20/npm 10 toolchain:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run format:check
npm run test:privacy
```

The existing canonical macOS CI runs:

```bash
swift test --package-path packages/schema/Swift
swift test --package-path apps/extension
swift test --package-path apps/daemon
bash tests/check-migrations-mirror.sh
npm run test:e2e:native -- --report test-results/e2e/native-smoke.json
```

Fixtures use documentation IP addresses and in-memory transport doubles. They do
not resolve domains, install extensions, or change system network settings.
Native smoke is synthetic package testing, not signed extension activation.
The privacy harness currently registers no shipped binaries: a passing result
checks the harness sandbox, not the extension's runtime network behavior.

## Unfulfilled signed-runtime acceptance

After the product privacy decision and provisioned signing/packaging work in
[#26](https://github.com/Boohi/mydata/issues/26):

1. Build and activate the signed system extension and its DNS proxy configuration
   on an authorized macOS test machine. Capture the exact commit, OS, entitlements,
   signing identity reference (never credentials), and approval result.
2. Observe a real `dig example.com` query and matching response in daemon stdout
   and the local database. Confirm correct A/AAAA results, NXDOMAIN behavior,
   TCP fragmentation/pipelining, UDP replies, cancellation, and no alternate
   resolver or autonomous/idle upstream traffic.
3. Measure DNS resolution overhead with and without the proxy on the same
   machine/resolver. Use a predefined synthetic corpus, alternate baseline/proxy
   runs, record sample counts and errors, and report the median of paired
   latency differences. The required median overhead is **under 5 ms**. Include
   connection setup and actual forwarding; do not substitute parser timings,
   discard errors silently, or weaken this threshold.
4. Complete #26's notarized DMG, downloaded-artifact stapler validation, and
   fresh-Mac installation evidence.

The parser benchmark is diagnostic only. Green source checks satisfy none of
these signed runtime or release gates by themselves. Keep #18 and #35 open
until their actual acceptance and policy requirements have been reconciled.
