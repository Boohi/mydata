# mydata

> See where your Mac is sending your data — in real time, by app, by country, by company.

**Status:** pre-release. v0.1 in active development. No binaries yet.

## What it is

A passive, local-only macOS app that captures outbound connection metadata via Apple's NetworkExtension framework and visualizes it as world maps, sankey flows, and per-app drilldowns. **It does not block traffic** (run alongside your firewall). **It makes zero network calls of its own** — every byte of your data stays on your Mac.

## What it is not

- Not a firewall (see LuLu, Little Snitch)
- Not an HTTPS interceptor — we never install a root CA
- Not a cloud service — no accounts, no telemetry, no servers

## Why

LuLu and Little Snitch are excellent firewalls but answer per-flow questions ("allow this connection?"). mydata answers aggregate questions ("how much data did Slack send to AWS this week? what country received the most bytes from this Mac yesterday?").

## Building from source

See [docs/build.md](docs/build.md).

## Roadmap

See [GitHub Issues](https://github.com/Boohi/mydata/issues) and the [v0.1 milestone](https://github.com/Boohi/mydata/milestone/1).

## License

AGPL-3.0. See [LICENSE](LICENSE).
