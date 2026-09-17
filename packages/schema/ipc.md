# Mydata IPC Wire Format

The format used between the Network Extension (sender) and the daemon
(receiver). Versioned, length-prefixed, binary, big-endian. Pure data —
no enrichment lives in the wire format; the daemon enriches after decode.

## Frame layout

Every frame on the wire is:

```
+---------+---------+---------+----------------+
| 4 bytes | 2 bytes | 1 byte  | payload bytes  |
| length  | version | type    | (length - 3)   |
+---------+---------+---------+----------------+
```

- `length` (uint32, big-endian): number of bytes that follow this field,
  inclusive of version + type + payload. Max frame = 65_535 bytes.
- `version` (uint16, big-endian): wire format version. Currently `1`.
  Receivers MUST reject any other version.
- `type` (uint8): message discriminator (see below).
- `payload`: message-specific bytes.

## Message types

| code | name        | direction          |
| ---- | ----------- | ------------------ |
| 0x01 | flowStarted | extension → daemon |
| 0x02 | flowEnded   | extension → daemon |
| 0x03 | dnsQueried  | extension → daemon |
| 0x04 | dnsResolved | extension → daemon |
| 0x10 | ping        | either             |
| 0x11 | pong        | either             |

### `flowStarted` (0x01) and `flowEnded` (0x02)

Both messages share the same payload shape:

```
+---------+---------+--------+--------+--------+--------+--------+--------+
| 8 bytes | 8 bytes | 1 byte | 1 byte | 2 byte | 2 byte | 16 b   | 16 b   |
| flow_id | ts_ns   | family | proto  | sport  | dport  | src    | dst    |
+---------+---------+--------+--------+--------+--------+--------+--------+
```

- `flow_id` (uint64, BE): extension-assigned, monotonic per extension run.
  Pairs `flowStarted` with `flowEnded`.
- `ts_ns` (int64, BE): Unix epoch nanoseconds at the time of capture.
- `family` (uint8): 4 = IPv4, 6 = IPv6.
- `proto` (uint8): IANA protocol number (6 = TCP, 17 = UDP).
- `sport`, `dport` (uint16, BE): source and destination ports.
- `src`, `dst` (16 bytes each): network-order address bytes. For IPv4,
  the first 12 bytes are zero and the address sits in bytes 12–15.

Total payload = 54 bytes. Total frame = 4 (length) + 2 (version) + 1 (type) + 54 = 61 bytes.

### `ping` (0x10) and `pong` (0x11)

Empty payload. Used for liveness checks and to keep the connection warm.

### `dnsQueried` (0x03)

Sent once per safely observed DNS query. The response is a separate `dnsResolved`
event; joining observations to application flows remains daemon-side work.

```
+---------+---------+----------+----------+
| 8 bytes | 2 bytes | 2 bytes  | variable |
| ts_ns   | qtype   | name_len | qname    |
+---------+---------+----------+----------+
```

- `ts_ns` (int64, BE): Unix epoch nanoseconds at the time the query was seen.
- `qtype` (uint16, BE): IANA DNS RR type (1 = A, 28 = AAAA, 5 = CNAME, etc.).
- `name_len` (uint16, BE): byte length of `qname`. Max 253 (DNS spec).
- `qname` (utf8): query name in presentation form. For internationalised
  domains, the extension sends the punycode (IDN-A) form because that is
  what the wire protocol carries.

Total payload = 12 + name_len bytes. Maximum frame = 4 + 2 + 1 + 12 + 253 = 272 bytes.

### `dnsResolved` (0x04)

An additive message type; version 1 and the exact `dnsQueried` bytes are unchanged.
Old receivers skip this unknown type without losing subsequent frames. A response
contains the original query payload, followed by:

- `rcode` (uint16, BE): DNS/EDNS response code, 0–4095.
- `address_count` (uint8): at most 64.
- For each address: `family` (uint8, 4 or 6), followed by exactly 4 or 16
  network-order address bytes.

The original query timestamp, name, and type are retained. The receiver rejects
unknown address families, over-limit counts, truncation, and trailing bytes.
No arbitrary hostname, URL, or endpoint is accepted in the address list.

A response is emitted only after its transaction ID and question name/type/class
match an outstanding query in that same original transport flow. Only IN-class
A/AAAA answer records at the end of the question's bounded CNAME chain are
reported. Unrelated answer, authority, and additional address records are excluded.
Truncated replies and nonzero response codes never provide resolved addresses.
An empty list is an observed response without usable addresses; it is not proof
that a lookup timed out. An unanswered query has only its query event.

The daemon's forward-only migration `0002_dns_resolutions.sql` retains old rows
as `event_kind = 'query'`, with `resolved_ips = '[]'`. New response rows have
`event_kind = 'response'`, JSON `resolved_ips`, and `rcode`. Count queries using
`event_kind = 'query'`; response events must not double the query count.

Both event types are best-effort metadata. Unsafe names, malformed packets,
ambiguous reused IDs, pending-state limits, or a full IPC queue can suppress
metadata without changing the bytes relayed by the proxy. This is not a complete
traffic ledger. Source proof and outstanding signed-runtime gates are described
in [DNS proxy verification](../../docs/qa/dns-proxy.md).

## Errors

If a receiver sees:

- Unknown `version`: close the connection and log.
- Unknown `type`: skip the frame (use `length` to advance), keep the connection.
- Truncated `length`: close the connection.

The daemon never crashes on bad input.
