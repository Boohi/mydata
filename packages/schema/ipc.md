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

## Errors

If a receiver sees:

- Unknown `version`: close the connection and log.
- Unknown `type`: skip the frame (use `length` to advance), keep the connection.
- Truncated `length`: close the connection.

The daemon never crashes on bad input.
