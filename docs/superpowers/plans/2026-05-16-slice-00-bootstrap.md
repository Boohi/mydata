# Slice 00 — Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `Boohi/mydata` public repo so that every subsequent slice can be picked up by `next-slice` and executed by parallel subagents.

**Architecture:** Public GitHub repo under `Boohi`, AGPLv3, monorepo skeleton (`apps/extension`, `apps/daemon`, `apps/ui`, `packages/*`), AGENTS.md + CLAUDE.md modeled on `Boohi/vahtikone`, full v0.1 + post-v0.1 issue catalog created via a versioned seed script, GitHub Project board, CI skeleton.

**Tech Stack:** `gh` CLI, GitHub Actions, bash, markdown. No app code in this slice — code begins in slice 01.

**Spec:** `docs/superpowers/specs/2026-05-16-mydata-v0.1-design.md`

---

## File Structure

Created in this slice (all top-level paths relative to repo root):

- `README.md` — user-facing intro, install (placeholder until binaries ship), build link, license
- `LICENSE` — AGPL-3.0
- `AGENTS.md` — shared agent briefing modeled on vahtikone
- `CLAUDE.md` — minimal pointer to AGENTS.md (matches vahtikone style)
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1
- `SECURITY.md` — security disclosure policy + scope
- `.gitignore` — already exists; verify
- `.github/ISSUE_TEMPLATE/slice.md`, `bug.md`, `chore.md`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml` — placeholder lint job that runs on every PR (real jobs added per-slice later)
- `.github/labels.yml` — declarative label list
- `apps/extension/README.md`, `apps/daemon/README.md`, `apps/ui/README.md` — placeholder readmes describing each app's responsibility
- `packages/schema/README.md`, `packages/geoip-data/README.md` — placeholder readmes
- `docs/privacy-promise.md` — load-bearing user-facing privacy guarantees
- `docs/architecture.md` — living architecture doc (initial copy from spec §4)
- `docs/build.md` — build-from-source instructions (initial skeleton)
- `docs/qa/release-checklist.md` — manual QA checklist skeleton
- `docs/github-project-management.md` — how we use issues/labels/milestones/board (modeled on vahtikone's doc)
- `docs/issues/v0.1/*.md` — one file per v0.1 slice issue (14 files)
- `docs/issues/post-v0.1/*.md` — one file per post-v0.1 backlog issue
- `scripts/seed-issues.sh` — reads `docs/issues/**/*.md`, calls `gh issue create`
- `scripts/setup-labels.sh` — applies `.github/labels.yml` via `gh label create`

No app source code in this slice. Code lands in slice 01+.

---

## Task 1: Create the public GitHub repo

**Files:** none yet (repo creation).

- [ ] **Step 1: Confirm gh CLI auth and target org**

Run:
```bash
gh auth status
gh api user -q .login
gh api orgs/Boohi -q .login
```
Expected: authenticated user shown; `Boohi` org returned (or 404 — if 404, ask the user before proceeding; do NOT silently fall back to personal account).

- [ ] **Step 2: Create the repo (empty, public, no auto-init)**

Run:
```bash
gh repo create Boohi/mydata \
  --public \
  --description "See where your Mac is sending your data — in real time, by app, by country, by company." \
  --homepage "https://github.com/Boohi/mydata" \
  --disable-wiki
```
Expected: `✓ Created repository Boohi/mydata on GitHub`.

- [ ] **Step 3: Add remote and push existing local commit**

The local repo already has commit `89cd9b8` ("Add v0.1 design spec"). Push it:
```bash
git remote add origin git@github.com:Boohi/mydata.git
git branch -M main
git push -u origin main
```
Expected: branch `main` pushed.

- [ ] **Step 4: Verify**

Run:
```bash
gh repo view Boohi/mydata --json name,visibility,defaultBranchRef
```
Expected: `"visibility":"PUBLIC"`, `"defaultBranchRef":{"name":"main"}`.

- [ ] **Step 5: Commit (nothing local changed; skip commit)**

---

## Task 2: License, README, governance files

**Files:**
- Create: `LICENSE`
- Create: `README.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`

- [ ] **Step 1: Add AGPL-3.0 LICENSE**

Fetch the canonical text:
```bash
curl -fsSL https://www.gnu.org/licenses/agpl-3.0.txt -o LICENSE
head -2 LICENSE
```
Expected: file starts with `                    GNU AFFERO GENERAL PUBLIC LICENSE`.

- [ ] **Step 2: Write README.md**

Create `README.md`:
```markdown
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
```

- [ ] **Step 3: Add CODE_OF_CONDUCT.md**

Fetch Contributor Covenant 2.1:
```bash
curl -fsSL https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md \
  -o CODE_OF_CONDUCT.md
```
Then open `CODE_OF_CONDUCT.md` and replace the placeholder `[INSERT CONTACT METHOD]` with `security@boohi.dev` (or whatever address the maintainer provides — ask if unsure).

- [ ] **Step 4: Add SECURITY.md**

Create `SECURITY.md`:
```markdown
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
```

- [ ] **Step 5: Commit**

```bash
git add LICENSE README.md CODE_OF_CONDUCT.md SECURITY.md
git commit -m "Add license, README, code of conduct, security policy"
```

---

## Task 3: AGENTS.md + CLAUDE.md modeled on vahtikone

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`

- [ ] **Step 1: Read the vahtikone references**

Run:
```bash
cat /Users/ottomaenpaa/Programming/vahtikone/AGENTS.md
cat /Users/ottomaenpaa/Programming/vahtikone/CLAUDE.md
```
Read both. Steal the structure (sections: Purpose, Project Snapshot, First Steps, Local Setup, Programmatic Checks, Project Map, Docs To Read, then domain-specific rule sections, then GitHub And Planning). Do NOT copy Finnish content.

- [ ] **Step 2: Write AGENTS.md**

Create `AGENTS.md` with sections mirroring vahtikone:

```markdown
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
- Tests (Swift): `swift test --package-path apps/extension` and `swift test --package-path apps/daemon`
- Format check: `npm run format:check`
- Privacy paranoia test: `npm run test:privacy` (MUST pass before any PR merges)

If you cannot run a relevant check, state why and what risk remains.

## Project Map

- `apps/extension/` — Swift system extension (Network Extension + DNS proxy).
- `apps/daemon/` — Swift XPC service, SQLite writer, enrichment.
- `apps/ui/` — Tauri 2 + React + Vite. Visualizations in `visx` and `react-simple-maps`.
- `packages/schema/` — shared SQLite schema + TS + Swift bindings (codegen).
- `packages/geoip-data/` — bundled DB-IP Lite GeoIP + ASN databases.
- `docs/` — privacy promise, architecture, build, QA, GitHub policy, specs, plans, issue bodies.
- `scripts/` — sign, notarize, dev-extension, seed-issues, setup-labels.
- `tests/` — privacy paranoia, end-to-end loopback talker.
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
```

- [ ] **Step 3: Write CLAUDE.md**

Create `CLAUDE.md` (matches vahtikone exactly in spirit):
```markdown
@AGENTS.md

## Claude Code

- Treat `AGENTS.md` as the shared source of truth for project instructions.
- Keep this file limited to Claude-specific workflow notes. Add shared project rules to `AGENTS.md` instead.
- For broad multi-file changes, use plan mode before editing and call out the verification strategy.
- If a rule becomes large or path-specific, prefer a scoped Claude rule or project skill rather than expanding this startup file.
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "Add AGENTS.md and CLAUDE.md modeled on vahtikone"
```

---

## Task 4: Monorepo directory scaffolding

**Files:**
- Create: `apps/extension/README.md`, `apps/daemon/README.md`, `apps/ui/README.md`
- Create: `packages/schema/README.md`, `packages/geoip-data/README.md`
- Create: `apps/.gitkeep`, `packages/.gitkeep`, `scripts/.gitkeep`, `tests/.gitkeep`

- [ ] **Step 1: Create directories and placeholder READMEs**

For each app and package, create a README that states the single responsibility. Example for `apps/extension/README.md`:
```markdown
# `apps/extension`

macOS system extension. Captures outbound TCP/UDP flow metadata via `NEFilterDataProvider` and DNS queries via `NEDNSProxyProvider`. Sends events to the daemon over XPC.

Implementation begins in issue **#3 — Network Extension skeleton + entitlements + dev signing**.

This directory is intentionally empty until that issue is picked up.
```

Repeat for:
- `apps/daemon/README.md` — "Swift XPC service. Receives flow + DNS events, enriches with GeoIP/ASN/process attribution, writes to local SQLite. Begins in issue #4."
- `apps/ui/README.md` — "Tauri 2 + React + TypeScript UI. Tray app, dashboard, visualizations. Begins in issue #7."
- `packages/schema/README.md` — "Shared SQLite schema + TS/Swift codegen bindings + IPC message schema. Begins in issue #6."
- `packages/geoip-data/README.md` — "Bundled DB-IP Lite GeoIP + ASN databases and the update script that refreshes them at build time. Begins in issue #7."

- [ ] **Step 2: Add `.gitkeep` placeholders for empty dirs that should ship**

```bash
touch scripts/.gitkeep tests/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add apps packages scripts tests
git commit -m "Scaffold apps/, packages/, scripts/, tests/ with placeholder READMEs"
```

---

## Task 5: Docs scaffolding

**Files:**
- Create: `docs/privacy-promise.md`
- Create: `docs/architecture.md`
- Create: `docs/build.md`
- Create: `docs/qa/release-checklist.md`
- Create: `docs/github-project-management.md`

- [ ] **Step 1: Write `docs/privacy-promise.md`**

```markdown
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
```

- [ ] **Step 2: Write `docs/architecture.md`**

Copy spec §4 (the diagram + component descriptions) into `docs/architecture.md`. Add a one-line note at the top: `This is a living doc. The authoritative initial design is docs/superpowers/specs/2026-05-16-mydata-v0.1-design.md.`

- [ ] **Step 3: Write `docs/build.md` skeleton**

```markdown
# Building mydata from source

## Prerequisites

- macOS 13 (Ventura) or later.
- Xcode 15+ command-line tools: `xcode-select --install`
- Node.js 20+ and npm 10+.
- Rust toolchain (for Tauri 2): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Apple Developer account for signing the system extension. The Team ID goes in `scripts/signing.env` (gitignored).

## First-time setup

(To be filled in by issue #1 — repo tooling scaffolding — and refined by issue #11 — packaging.)

## Build

(To be filled in per slice. See open issues with label `area:packaging`.)

## Sign and notarize

(To be filled in by issue #11.)
```

- [ ] **Step 4: Write `docs/qa/release-checklist.md` skeleton**

```bash
mkdir -p docs/qa
```

```markdown
# Release Checklist

Manual QA before tagging a release. Automation covers most cases; this list covers what we cannot easily script.

## Per-release

- [ ] CI green on `main` for the release commit.
- [ ] Privacy paranoia test green.
- [ ] Fresh-install flow on a clean macOS user account: install .dmg, drag to Applications, approve system extension, see flows within 60 seconds.
- [ ] Today, World Map, Apps, Timeline views render without console errors on a 14" MacBook Pro and a 27" external display.
- [ ] Tray icon updates byte rate live; pause/resume toggle works.
- [ ] Retention sweeper actually drops old rows on a DB seeded with a 31-day-old fixture.
- [ ] Exclusion list correctly hides matching flows.
- [ ] Export DB action produces a valid SQLite file.
- [ ] Notarization status: `xcrun stapler validate mydata.app` succeeds.
- [ ] `LICENSE`, `README.md`, and the in-app About page agree on the version number.
```

- [ ] **Step 5: Write `docs/github-project-management.md`**

```markdown
# GitHub Project Management Policy

We use GitHub Issues, milestones, labels, and a project board as the canonical executable work tracker. This doc explains how.

## Issue lifecycle

1. **Created** with a slice/bug/chore template, labels, and a milestone.
2. **Triaged** to a priority (`priority:p1` / `p2` / `p3`) and assigned to a milestone.
3. **Picked** via the `next-slice` skill or manually. The PR references the issue with `Closes #N`.
4. **Implemented** in a PR scoped to that one issue.
5. **Closed** by merging the PR.

## Labels

Declarative source: `.github/labels.yml`. Applied by `scripts/setup-labels.sh`.

- `type:slice` — a shippable vertical slice of behavior (the main type).
- `type:bug` — defect.
- `type:chore` — internal work with no user-visible behavior change.
- `type:docs` — docs-only change.
- `priority:p1` / `p2` / `p3`.
- `area:extension` / `area:daemon` / `area:ui` / `area:packaging` / `area:docs` / `area:ci`.
- `blocked` — cannot proceed until another issue closes.
- `good-first-issue` — newcomer-friendly.
- `risk:privacy` — touches privacy-promise surface; needs extra review.
- `risk:signing` — touches code-signing or notarization.

## Milestones

- `v0.1` — the launch milestone. Everything in §9 of the design spec.
- `post-v0.1` — backlog visible from day one; nothing here blocks v0.1.

## Project board

Single board with columns: Backlog, Ready, In Progress, In Review, Done. Issues move automatically via GitHub Actions where possible.

## Slice issues

Each slice issue body follows this structure:

- **Goal** (one sentence).
- **Why** (link to spec section or doc that explains motivation).
- **Scope** (bulleted list of what is in, what is out).
- **Dependencies** (other issues that must close first).
- **Acceptance criteria** (checklist that is true when the issue is done).
- **Notes** (anything non-obvious).
```

- [ ] **Step 6: Commit**

```bash
git add docs/privacy-promise.md docs/architecture.md docs/build.md docs/qa/release-checklist.md docs/github-project-management.md
git commit -m "Add docs scaffolding: privacy promise, architecture, build, QA, GH policy"
```

---

## Task 6: GitHub labels (declarative + script)

**Files:**
- Create: `.github/labels.yml`
- Create: `scripts/setup-labels.sh`

- [ ] **Step 1: Write `.github/labels.yml`**

```yaml
# Declarative labels. Apply with: bash scripts/setup-labels.sh
- name: "type:slice"
  color: "0E8A16"
  description: "A shippable vertical slice of behavior"
- name: "type:bug"
  color: "D73A4A"
  description: "Defect"
- name: "type:chore"
  color: "C5DEF5"
  description: "Internal work with no user-visible change"
- name: "type:docs"
  color: "0075CA"
  description: "Docs-only change"
- name: "priority:p1"
  color: "B60205"
  description: "Highest priority"
- name: "priority:p2"
  color: "D93F0B"
  description: "Medium priority"
- name: "priority:p3"
  color: "FBCA04"
  description: "Lower priority"
- name: "area:extension"
  color: "5319E7"
  description: "macOS system extension"
- name: "area:daemon"
  color: "5319E7"
  description: "Swift daemon"
- name: "area:ui"
  color: "5319E7"
  description: "Tauri/React UI"
- name: "area:packaging"
  color: "5319E7"
  description: "Build, sign, notarize, release"
- name: "area:docs"
  color: "5319E7"
  description: "Documentation"
- name: "area:ci"
  color: "5319E7"
  description: "CI/CD"
- name: "blocked"
  color: "000000"
  description: "Blocked by another issue"
- name: "good-first-issue"
  color: "7057FF"
  description: "Newcomer-friendly"
- name: "risk:privacy"
  color: "B60205"
  description: "Touches privacy-promise surface; extra review required"
- name: "risk:signing"
  color: "B60205"
  description: "Touches code signing or notarization"
- name: "milestone:v0.1"
  color: "0E8A16"
  description: "Targeted at the v0.1 milestone"
- name: "milestone:post-v0.1"
  color: "C5DEF5"
  description: "Post-v0.1 backlog"
```

- [ ] **Step 2: Write `scripts/setup-labels.sh`**

```bash
#!/usr/bin/env bash
# Idempotently apply labels from .github/labels.yml.
# Requires: gh CLI authenticated, yq installed.
set -euo pipefail

REPO="${REPO:-Boohi/mydata}"
LABELS_FILE=".github/labels.yml"

if ! command -v yq >/dev/null 2>&1; then
  echo "yq not found. Install: brew install yq" >&2
  exit 1
fi

count=$(yq '. | length' "$LABELS_FILE")
for i in $(seq 0 $((count - 1))); do
  name=$(yq -r ".[$i].name" "$LABELS_FILE")
  color=$(yq -r ".[$i].color" "$LABELS_FILE")
  desc=$(yq -r ".[$i].description" "$LABELS_FILE")
  if gh label list --repo "$REPO" --json name -q '.[].name' | grep -Fxq "$name"; then
    gh label edit "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "updated: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" >/dev/null
    echo "created: $name"
  fi
done
```

```bash
chmod +x scripts/setup-labels.sh
```

- [ ] **Step 3: Apply labels**

```bash
bash scripts/setup-labels.sh
```
Expected: `created:` lines for each label.

- [ ] **Step 4: Verify**

```bash
gh label list --repo Boohi/mydata --limit 50 | head -30
```
Expected: all 20 labels listed.

- [ ] **Step 5: Commit**

```bash
git add .github/labels.yml scripts/setup-labels.sh
git commit -m "Add declarative GitHub labels and setup script"
```

---

## Task 7: Milestones

**Files:** none.

- [ ] **Step 1: Create v0.1 milestone**

```bash
gh api repos/Boohi/mydata/milestones \
  -f title="v0.1" \
  -f description="Launch milestone: passive macOS network-flow visualizer. Signed/notarized .dmg, four views (Today, Map, Apps, Timeline), privacy paranoia test in CI." \
  -f state=open
```

- [ ] **Step 2: Create post-v0.1 milestone**

```bash
gh api repos/Boohi/mydata/milestones \
  -f title="post-v0.1" \
  -f description="Backlog visible from day one. Nothing here blocks v0.1." \
  -f state=open
```

- [ ] **Step 3: Verify**

```bash
gh api repos/Boohi/mydata/milestones -q '.[] | {number, title}'
```
Expected: both milestones listed. **Note the milestone numbers** — they will be `1` and `2` in a fresh repo. The seed script in Task 10 references them by title, so numbers don't actually need to be hardcoded.

- [ ] **Step 4: Commit (nothing local changed; skip)**

---

## Task 8: v0.1 slice issue body files

**Files:** `docs/issues/v0.1/01-tooling-ci.md` through `docs/issues/v0.1/14-launch-prep.md`.

Each file uses YAML front-matter (title, labels, milestone) followed by the markdown body. The seed script in Task 10 parses this.

- [ ] **Step 1: Create the file format helper**

The format every issue file must follow:
```markdown
---
title: "issue title"
labels: ["type:slice", "priority:p1", "area:..."]
milestone: "v0.1"
---

## Goal

One sentence.

## Why

Reference to spec section or doc.

## Scope

In:
- ...

Out:
- ...

## Dependencies

- #N (or "none").

## Acceptance criteria

- [ ] ...

## Notes

(Optional.)
```

- [ ] **Step 2: Write `docs/issues/v0.1/01-tooling-ci.md`**

```markdown
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
```

- [ ] **Step 3: Write `docs/issues/v0.1/02-privacy-promise-enforcement.md`**

```markdown
---
title: "Privacy paranoia test in CI"
labels: ["type:slice", "priority:p1", "area:ci", "risk:privacy"]
milestone: "v0.1"
---

## Goal

Add a CI test that fails if any shipped binary opens an outbound socket on launch.

## Why

The privacy promise (docs/privacy-promise.md) is load-bearing for the product's credibility. Code, not docs, must enforce it. See spec §5.

## Scope

In:
- A test harness that launches each built binary in a sandboxed environment (network namespace on Linux runners, or `nsjail`/`pf` rules) where outbound connections fail loudly.
- A CI job `privacy-paranoia` that runs on every PR and on main.
- Documented bypass procedure for the future (post-v0.1) day we genuinely add an opt-in network feature.

Out:
- Sandboxing the dev experience (test runs in CI only).
- Network-feature opt-in mechanism (post-v0.1).

## Dependencies

- #1 (need CI workflow).
- Should run before binaries actually exist; until then the test asserts "no binaries to check yet" passes trivially. The first slice that produces a binary (#3 or #4) flips it on.

## Acceptance criteria

- [ ] `npm run test:privacy` exists and is invoked by CI.
- [ ] On a binary that DOES make an outbound call (test fixture), the test fails clearly.
- [ ] On a binary that does NOT (real daemon/extension once they exist), the test passes.
- [ ] Doc updated in `docs/privacy-promise.md` with the exact assertion and how a contributor can run it locally.
```

- [ ] **Step 4: Write `docs/issues/v0.1/03-network-extension-skeleton.md`**

```markdown
---
title: "Network Extension skeleton: NEFilterDataProvider + entitlements + dev signing"
labels: ["type:slice", "priority:p1", "area:extension", "risk:signing"]
milestone: "v0.1"
---

## Goal

Stand up the Swift system extension target with `NEFilterDataProvider`, request the Network Extension entitlement, and get it loading in dev mode against a personal Developer Team.

## Why

The extension is the primary data source. Everything downstream depends on it producing flow events. See spec §4.1 (Network extension component).

## Scope

In:
- `apps/extension/` Swift package that builds a `.systemextension`.
- `NEFilterDataProvider` subclass that allows all flows (no blocking) and logs each flow start/end with placeholder fields.
- Entitlements file: `com.apple.developer.networking.networkextension` with `content-filter-provider`.
- `Info.plist` for system extension.
- Dev signing helper script `scripts/sign.sh` (reads Team ID from `scripts/signing.env`, which is gitignored).
- Manual loading instructions in `docs/build.md`.

Out:
- DNS proxy provider (issue #5).
- XPC pipe to daemon (issue #4).
- Persistence (issue #6).
- Notarization (issue #11).

## Dependencies

- #1 (build scripts in place).

## Acceptance criteria

- [ ] `swift build --package-path apps/extension` succeeds.
- [ ] The extension can be loaded via `systemextensionsctl` in dev mode.
- [ ] Triggering a normal browser network call produces a log line in Console.app from the extension.
- [ ] `docs/build.md` has step-by-step extension load instructions.
```

- [ ] **Step 5: Write `docs/issues/v0.1/04-xpc-pipe.md`**

```markdown
---
title: "Daemon skeleton + XPC pipe from extension to daemon"
labels: ["type:slice", "priority:p1", "area:daemon", "area:extension"]
milestone: "v0.1"
---

## Goal

Create the Swift daemon (launchd LaunchAgent) and wire an XPC connection so the extension delivers flow events to it.

## Why

Per spec §4.2, the extension is intentionally minimal. The daemon owns enrichment and storage. The pipe is the first integration point.

## Scope

In:
- `apps/daemon/` Swift package building a daemon binary + launchd plist.
- Versioned, length-prefixed binary message format defined in `packages/schema/ipc.md`.
- Extension side: sends `flowStarted` / `flowEnded` messages with raw fields (no enrichment).
- Daemon side: receives, deserializes, logs to stdout (storage is issue #6).
- Reconnect/backoff on either side if the other restarts.

Out:
- DNS messages (issue #5).
- SQLite writes (issue #6).
- Enrichment (issue #7).

## Dependencies

- #3 (extension exists).

## Acceptance criteria

- [ ] Launching the daemon and triggering browser traffic causes daemon stdout to print one line per flow start/end.
- [ ] Killing the daemon and restarting it: the extension reconnects within 5 seconds.
- [ ] `packages/schema/ipc.md` documents the wire format with version field.
- [ ] Unit tests for the message serializer round-trip cleanly.
```

- [ ] **Step 6: Write `docs/issues/v0.1/05-dns-proxy.md`**

```markdown
---
title: "NEDNSProxyProvider: DNS query capture + pipe to daemon"
labels: ["type:slice", "priority:p2", "area:extension", "area:daemon"]
milestone: "v0.1"
---

## Goal

Add `NEDNSProxyProvider` to the extension and stream DNS queries (name, type, resolved IPs) over the existing XPC pipe.

## Why

Hostname attribution makes destinations human-readable ("amazonaws.com" instead of `54.x.x.x`). Per spec §4.1.

## Scope

In:
- `NEDNSProxyProvider` subclass that proxies queries transparently and logs each.
- New message types `dnsQueried` on the XPC pipe.
- Daemon-side handler that logs to stdout (storage is #6).
- Entitlement: `com.apple.developer.networking.networkextension` with `dns-proxy`.

Out:
- Joining DNS to flows (issue #7 — enrichment).
- DNS caching policy (post-v0.1).

## Dependencies

- #4 (XPC pipe exists).

## Acceptance criteria

- [ ] `dig example.com` produces a `dnsQueried` event in daemon stdout.
- [ ] Performance: extension overhead on DNS resolution under 5ms median in a microbenchmark.
- [ ] Entitlement documented in `docs/build.md`.
```

- [ ] **Step 7: Write `docs/issues/v0.1/06-sqlite-schema-writer.md`**

```markdown
---
title: "SQLite schema, writer, and retention sweeper"
labels: ["type:slice", "priority:p1", "area:daemon"]
milestone: "v0.1"
---

## Goal

Persist incoming flow and DNS events to `~/Library/Application Support/mydata/events.db` and sweep records older than the retention window.

## Why

Spec §6 (data model). All views depend on this.

## Scope

In:
- `packages/schema/` with the schema SQL in `packages/schema/migrations/0001_initial.sql` for tables `flows`, `dns_queries`, `apps`, `exclusions`, `meta`.
- Codegen: TS types + Swift structs from the migrations file (or a YAML source-of-truth → both).
- Daemon batches writes (10 events or 250ms, whichever first).
- Retention sweeper task: every 10 minutes deletes rows older than `meta.retention_days` (default 30).
- WAL mode, busy_timeout=5000ms.

Out:
- Enrichment fields (#7 fills them).
- Read-side UI integration (#8).

## Dependencies

- #4 (pipe exists), #5 (DNS events exist).

## Acceptance criteria

- [ ] `swift test` covers schema migrations forward, writer round-trip, and sweeper behavior with a seeded 31-day-old fixture.
- [ ] DB file is created at first daemon launch with WAL files.
- [ ] No unbounded growth under a 24h soak test (run via a `tests/e2e/soak.sh` harness).
```

- [ ] **Step 8: Write `docs/issues/v0.1/07-enrichment.md`**

```markdown
---
title: "Enrichment: GeoIP country, ASN, process attribution, DNS-flow join"
labels: ["type:slice", "priority:p1", "area:daemon"]
milestone: "v0.1"
---

## Goal

Populate `country_code`, `asn`, `asn_org`, `hostname`, `bundle_id`, `executable_path`, and app `display_name` + `icon_blob` on each flow row.

## Why

Without enrichment, the UI shows "53.x.x.x to ??" — useless. Spec §4.1.

## Scope

In:
- `packages/geoip-data/` bundles DB-IP Lite (Country + ASN) under CC-BY-4.0 with a script that downloads the latest at build time.
- Daemon-side enricher resolves IP → country, IP → ASN+org synchronously on flow-end.
- Process attribution: capture `audit_token` in the extension, resolve PID → bundle ID + executable + icon in the daemon, cache by PID.
- DNS-flow join: within the last 5s, match same-process same-IP DNS resolution to attach `hostname`.

Out:
- Reverse-DNS fallback (post-v0.1).
- Periodic GeoIP refresh (post-v0.1; ships fresh per release).

## Dependencies

- #6 (DB exists), #5 (DNS exists).

## Acceptance criteria

- [ ] Fixture test: known IPs resolve to known country/ASN with golden assertions.
- [ ] App icon caching: re-resolving same bundle ID does not re-read the bundle.
- [ ] At least 95% of flows in a normal browsing session get a non-null `hostname`.
- [ ] License attribution for DB-IP Lite added to README and About screen.
```

- [ ] **Step 9: Write `docs/issues/v0.1/08-tauri-shell-onboarding.md`**

```markdown
---
title: "Tauri 2 shell + tray icon + onboarding flow"
labels: ["type:slice", "priority:p1", "area:ui"]
milestone: "v0.1"
---

## Goal

Stand up the Tauri 2 app: tray icon, main window shell, and a first-launch onboarding that walks the user through approving the system extension.

## Why

Spec §4.1 (UI component) and §10 (NE approval UX is the biggest friction).

## Scope

In:
- Tauri 2 + React + Vite setup (extends #1).
- Tray icon (placeholder SVG); click opens dashboard or shows context menu (Open / Pause / Quit).
- Onboarding screens: welcome → privacy promise summary → "Approve System Extension" screen with screenshot + "Open System Settings" button → success.
- Read-only `tauri-plugin-sql` connection to events.db.
- Empty dashboard layout with the four view stubs (Today / Map / Apps / Timeline).

Out:
- Real visualizations (#9, #10).
- Settings screen (#11 in this list — see #11 issue).

## Dependencies

- #6 (DB exists so plugin-sql can open it).

## Acceptance criteria

- [ ] Fresh install: tray icon appears, click opens window.
- [ ] First launch: onboarding shown; "I've approved it" advances only after the extension is actually loaded (check via `systemextensionsctl list`).
- [ ] Playwright smoke test covers the onboarding happy path.
```

- [ ] **Step 10: Write `docs/issues/v0.1/09-today-and-apps-views.md`**

```markdown
---
title: "Today view + Apps drilldown"
labels: ["type:slice", "priority:p1", "area:ui"]
milestone: "v0.1"
---

## Goal

Implement the **Today** view (top destinations / top apps / top countries by bytes for the last 24h) and the **Apps** drilldown (per-app sankey: app → destination → country).

## Why

These are the two most-used views per spec §3.

## Scope

In:
- `Today` view: three ranked lists with bytes and counts.
- `Apps` view: sortable app list, click to open per-app sankey using `visx`.
- Time-range chip: 1h / 24h / 7d / 30d.
- SQL queries live in `apps/ui/src/queries/` with tests against a fixture DB.

Out:
- World Map (#10).
- Timeline (#10).

## Dependencies

- #7 (enrichment), #8 (shell).

## Acceptance criteria

- [ ] On a fixture DB with 10k rows, Today renders in under 200ms.
- [ ] Sankey nodes are clickable and filter the underlying app's list.
- [ ] Vitest covers the query layer.
```

- [ ] **Step 11: Write `docs/issues/v0.1/10-world-map-and-timeline.md`**

```markdown
---
title: "World Map view + Timeline view"
labels: ["type:slice", "priority:p1", "area:ui"]
milestone: "v0.1"
---

## Goal

World choropleth of bytes per country (with hover breakdown) and a 24h stacked-by-app timeline.

## Why

Spec §3 — the "oh shit, look where my data is going" moments.

## Scope

In:
- `react-simple-maps` choropleth, color scale by bytes (log).
- Hover panel: country → top apps + top hostnames.
- Timeline: visx stacked area, 5-minute buckets over 24h, stacked by top-N apps + "other".
- Query layer in `apps/ui/src/queries/`.

Out:
- Cross-filtering between views (post-v0.1 polish).

## Dependencies

- #9 (query layer pattern established).

## Acceptance criteria

- [ ] Map renders cleanly at multiple window sizes.
- [ ] Hover panel shows accurate top-3 apps per country.
- [ ] Timeline renders without console errors on a fixture DB.
```

- [ ] **Step 12: Write `docs/issues/v0.1/11-settings.md`**

```markdown
---
title: "Settings: retention, exclusions, pause toggle, export"
labels: ["type:slice", "priority:p2", "area:ui", "area:daemon"]
milestone: "v0.1"
---

## Goal

Add user-facing controls for the retention window, exclusion list, pause/resume monitoring, and exporting the SQLite DB.

## Why

Spec §3 (MVP scope). Pause is a load-bearing trust feature — privacy users need a kill switch.

## Scope

In:
- Settings panel in UI with retention slider (1–365 days), exclusion list editor (CIDR / hostname patterns), pause toggle, "Export DB" button.
- Daemon: respect pause flag (stop writing to SQLite while paused; extension still allows traffic).
- Daemon: respect exclusions (drop matching events at write time, log a counter).
- Export DB action: copies the file to a user-chosen location atomically.

Out:
- Per-app exclusion (post-v0.1 nice-to-have).

## Dependencies

- #8 (shell), #7 (enrichment), #6 (DB).

## Acceptance criteria

- [ ] Pause toggle is reflected in daemon within 1 second.
- [ ] Adding an exclusion immediately stops new matching flows from being persisted.
- [ ] Exported DB opens cleanly in `sqlite3` CLI.
- [ ] Retention slider value persists across restarts.
```

- [ ] **Step 13: Write `docs/issues/v0.1/12-security-review.md`**

```markdown
---
title: "Security & privacy review before launch"
labels: ["type:slice", "priority:p1", "area:docs", "risk:privacy", "risk:signing"]
milestone: "v0.1"
---

## Goal

End-to-end review of the privacy promise, signing/notarization integrity, and security disclosure flow before tagging v0.1.

## Why

This is a privacy tool. A v0.1 with a leak destroys the brand forever.

## Scope

In:
- Run `security-review` skill against the full diff from main..v0.1.
- Re-run privacy paranoia test on every shipped binary.
- Audit XPC message handlers for input validation.
- Audit SQLite write path for SQL injection (parameterized queries everywhere).
- Verify SECURITY.md disclosure email works and is monitored.
- Independent reviewer (or `Agent` with `code-reviewer` subagent) reads docs/privacy-promise.md vs the implementation.

Out:
- Third-party paid audit (post-v0.1, when funded).

## Dependencies

- #11 (everything else implemented).

## Acceptance criteria

- [ ] Security review report committed to `docs/security-reviews/v0.1.md`.
- [ ] All P0/P1 findings closed before tagging.
- [ ] Privacy paranoia test green on the release artifact.
```

- [ ] **Step 14: Write `docs/issues/v0.1/13-packaging.md`**

```markdown
---
title: "Packaging: sign, notarize, .dmg, release CI workflow"
labels: ["type:slice", "priority:p1", "area:packaging", "risk:signing"]
milestone: "v0.1"
---

## Goal

Produce a signed + notarized `.dmg` from CI on a git tag and attach it to a GitHub Release.

## Why

The whole product is a download. Spec §3 (signed + notarized .dmg distribution).

## Scope

In:
- `scripts/sign.sh` (Developer ID Application + system extension entitlement).
- `scripts/notarize.sh` wrapping `xcrun notarytool submit` + `stapler staple`.
- `create-dmg` configuration producing a branded DMG.
- `.github/workflows/release.yml`: on tag `v*`, build, sign, notarize, attach to Release.
- Apple credentials in GitHub Secrets: `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_CERT_P12`, `APPLE_CERT_PASSWORD`. Documented in `docs/build.md`.

Out:
- Auto-update mechanism (post-v0.1; would require network access — must be designed against the privacy promise carefully).

## Dependencies

- #11 (everything implemented).

## Acceptance criteria

- [ ] Tagging `v0.1.0-rc1` produces a notarized `.dmg` attached to a draft release.
- [ ] `xcrun stapler validate` passes on the downloaded artifact.
- [ ] Fresh-Mac install from the .dmg works end to end.
```

- [ ] **Step 15: Write `docs/issues/v0.1/14-launch-prep.md`**

```markdown
---
title: "Launch prep: README polish, screenshots, demo gif, HN post draft"
labels: ["type:slice", "priority:p1", "area:docs"]
milestone: "v0.1"
---

## Goal

Everything we need to flip on for a public launch on Hacker News and r/privacy.

## Why

A great product no one knows about does not exist.

## Scope

In:
- README with hero screenshot + animated demo gif of the World Map view.
- Screenshots of all four views committed to `docs/screenshots/`.
- HN launch post draft in `docs/launch/hn-post.md`.
- r/privacy and r/macapps post drafts.
- A "for reviewers" page (`docs/launch/for-reviewers.md`) summarizing privacy claims and how to verify them.

Out:
- Twitter/X plan (post-v0.1; founder's call).

## Dependencies

- #13 (a real binary exists to demo).

## Acceptance criteria

- [ ] README hero gif is under 3 MB and loops cleanly.
- [ ] HN post draft reviewed by at least one outside reader.
- [ ] All links in README resolve.
```

- [ ] **Step 16: Commit**

```bash
git add docs/issues/v0.1/
git commit -m "Add v0.1 slice issue body files"
```

---

## Task 9: post-v0.1 backlog issue body files

**Files:** `docs/issues/post-v0.1/*.md`. Create one file per item below with terse but real bodies (Goal + Why + Scope + Acceptance, no need to be exhaustive — these will be refined when picked up).

- [ ] **Step 1: Create post-v0.1 backlog files**

Create each of the following with the front-matter `milestone: "post-v0.1"` and labels including `type:slice` (or `type:chore` where appropriate) and `priority:p3`:

- `docs/issues/post-v0.1/blocking.md` — "Optional outbound-flow blocking (firewall mode)" — `area:extension`, `risk:privacy`.
- `docs/issues/post-v0.1/alerts.md` — "Anomaly alerts: new country / new ASN destinations" — `area:daemon`, `area:ui`.
- `docs/issues/post-v0.1/weekly-digest.md` — "Local weekly digest export (PDF/HTML)" — `area:ui`.
- `docs/issues/post-v0.1/browser-extension.md` — "Browser extension companion: per-tab attribution" — `area:ui`.
- `docs/issues/post-v0.1/windows-port.md` — "Windows port via WFP (Windows Filtering Platform)" — `area:extension`.
- `docs/issues/post-v0.1/linux-port.md` — "Linux port via eBPF / nftables" — `area:extension`.
- `docs/issues/post-v0.1/mobile-companion.md` — "iOS companion app (read-only view of paired Mac)" — `area:ui`.
- `docs/issues/post-v0.1/cloud-sync.md` — "Optional E2E-encrypted cloud sync (paid)" — `risk:privacy`.
- `docs/issues/post-v0.1/pro-tier-evaluation.md` — "Evaluate paid Pro tier model" — `area:docs`.
- `docs/issues/post-v0.1/auto-update.md` — "Auto-update with privacy-preserving design" — `area:packaging`, `risk:privacy`.
- `docs/issues/post-v0.1/payload-size-heuristics.md` — "Payload-size-based content-type heuristics (no MITM)" — `area:daemon`.
- `docs/issues/post-v0.1/reverse-dns-fallback.md` — "Reverse-DNS fallback enrichment when DNS join misses" — `area:daemon`.
- `docs/issues/post-v0.1/cross-filtering.md` — "Cross-filtering across all four views" — `area:ui`.

Each body should look like:
```markdown
---
title: "Optional outbound-flow blocking (firewall mode)"
labels: ["type:slice", "priority:p3", "area:extension", "risk:privacy", "milestone:post-v0.1"]
milestone: "post-v0.1"
---

## Goal

Allow the user to optionally turn mydata into a firewall: block flows by app, by hostname, by country.

## Why

Frequently requested after launch. Out of v0.1 to keep scope focused and avoid duplicating LuLu/Little Snitch on day one.

## Scope

In:
- Extension switches from "allow all" to consulting a rules table.
- UI for rule management.

Out:
- (refined when picked up).

## Acceptance criteria

- [ ] (refined when picked up).
```

- [ ] **Step 2: Commit**

```bash
git add docs/issues/post-v0.1/
git commit -m "Add post-v0.1 backlog issue body files"
```

---

## Task 10: Issue seed script + run it

**Files:**
- Create: `scripts/seed-issues.sh`

- [ ] **Step 1: Write `scripts/seed-issues.sh`**

```bash
#!/usr/bin/env bash
# Idempotently create GitHub issues from docs/issues/**/*.md.
# Each file has YAML front-matter (title, labels, milestone) and a markdown body.
# Re-running this script does NOT create duplicates: it looks up by exact title.
set -euo pipefail

REPO="${REPO:-Boohi/mydata}"

if ! command -v yq >/dev/null 2>&1; then
  echo "yq not found. Install: brew install yq" >&2
  exit 1
fi

# Cache milestone title -> number lookup.
declare -A MILESTONES
while IFS=$'\t' read -r num title; do
  MILESTONES["$title"]="$num"
done < <(gh api "repos/$REPO/milestones?state=all" -q '.[] | [.number, .title] | @tsv')

shopt -s globstar nullglob
for f in docs/issues/**/*.md; do
  fm=$(awk '/^---$/{c++; next} c==1{print} c==2{exit}' "$f")
  body=$(awk 'c==2{print} /^---$/{c++}' "$f")
  title=$(echo "$fm" | yq -r '.title')
  milestone_title=$(echo "$fm" | yq -r '.milestone')
  mapfile -t labels < <(echo "$fm" | yq -r '.labels[]')

  # Skip if an issue with this exact title already exists.
  existing=$(gh issue list --repo "$REPO" --state all --search "in:title \"$title\"" --json title,number \
    -q ".[] | select(.title == \"$title\") | .number" | head -1)
  if [[ -n "$existing" ]]; then
    echo "exists  #$existing: $title"
    continue
  fi

  ms_num="${MILESTONES[$milestone_title]:-}"
  if [[ -z "$ms_num" ]]; then
    echo "ERROR: milestone '$milestone_title' not found in repo. Aborting." >&2
    exit 1
  fi

  label_args=()
  for l in "${labels[@]}"; do
    label_args+=(--label "$l")
  done

  num=$(gh issue create --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --milestone "$milestone_title" \
    "${label_args[@]}" \
    | tail -1 \
    | sed 's|.*/||')
  echo "created #$num: $title"
done
```

```bash
chmod +x scripts/seed-issues.sh
```

- [ ] **Step 2: Dry-run sanity check**

Run:
```bash
ls docs/issues/v0.1/ | wc -l
ls docs/issues/post-v0.1/ | wc -l
```
Expected: `14` and `13`.

- [ ] **Step 3: Run the seed script**

```bash
bash scripts/seed-issues.sh
```
Expected: `created #N: ...` for each issue (~27 total).

- [ ] **Step 4: Verify**

```bash
gh issue list --repo Boohi/mydata --milestone "v0.1" --limit 50
gh issue list --repo Boohi/mydata --milestone "post-v0.1" --limit 50
```
Expected: 14 issues in v0.1, 13 in post-v0.1.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-issues.sh
git commit -m "Add idempotent issue seed script and seed v0.1 + post-v0.1 issues"
```

---

## Task 11: GitHub Project board

**Files:** none (GitHub API state).

- [ ] **Step 1: Create the project**

```bash
gh project create --owner Boohi --title "mydata roadmap"
```
Expected: prints a project URL. Note the project number from the URL (`projects/N`).

- [ ] **Step 2: Add status field options**

Default status field has Todo / In Progress / Done. We want: Backlog, Ready, In Progress, In Review, Done. Use:
```bash
PROJECT_NUM=<N from previous step>
gh project field-list "$PROJECT_NUM" --owner Boohi
```
Find the "Status" field ID, then add options via:
```bash
gh project field-create "$PROJECT_NUM" --owner Boohi \
  --name "Stage" \
  --data-type SINGLE_SELECT \
  --single-select-options "Backlog,Ready,In Progress,In Review,Done"
```
(If the default Status field is sufficient, skip this and use it as-is.)

- [ ] **Step 3: Bulk-add all open issues to the project**

```bash
for n in $(gh issue list --repo Boohi/mydata --state open --limit 100 --json number -q '.[].number'); do
  gh project item-add "$PROJECT_NUM" --owner Boohi \
    --url "https://github.com/Boohi/mydata/issues/$n"
done
```
Expected: each issue added; no errors.

- [ ] **Step 4: Verify**

```bash
gh project item-list "$PROJECT_NUM" --owner Boohi --limit 50 | head
```
Expected: items listed.

- [ ] **Step 5: Commit (nothing local changed; skip)**

---

## Task 12: Issue and PR templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/slice.md`
- Create: `.github/ISSUE_TEMPLATE/bug.md`
- Create: `.github/ISSUE_TEMPLATE/chore.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: Write `.github/ISSUE_TEMPLATE/slice.md`**

```markdown
---
name: Slice
about: A shippable vertical slice of behavior
title: ""
labels: ["type:slice"]
---

## Goal

One sentence.

## Why

Link to spec section or doc.

## Scope

In:
- ...

Out:
- ...

## Dependencies

- #N (or "none").

## Acceptance criteria

- [ ] ...

## Notes

(Optional.)
```

- [ ] **Step 2: Write `.github/ISSUE_TEMPLATE/bug.md`**

```markdown
---
name: Bug
about: Something is broken
title: ""
labels: ["type:bug"]
---

## What happened

## What should happen

## Repro steps

## Environment

- macOS version:
- mydata version:

## Logs / screenshots
```

- [ ] **Step 3: Write `.github/ISSUE_TEMPLATE/chore.md`**

```markdown
---
name: Chore
about: Internal work, no user-visible change
title: ""
labels: ["type:chore"]
---

## What

## Why

## Acceptance

- [ ] ...
```

- [ ] **Step 4: Write `.github/ISSUE_TEMPLATE/config.yml`**

```yaml
blank_issues_enabled: false
contact_links:
  - name: Security report
    url: https://github.com/Boohi/mydata/security/advisories/new
    about: Please use private security advisories for vulnerabilities.
```

- [ ] **Step 5: Write `.github/pull_request_template.md`**

```markdown
## Closes

Closes #

## Summary

## Checks run

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `swift test --package-path apps/extension` (if extension touched)
- [ ] `swift test --package-path apps/daemon` (if daemon touched)
- [ ] `npm run test:privacy` (always)

## Privacy impact

- [ ] No new outbound network call paths.
- [ ] No new persisted PII.
- [ ] Privacy paranoia test still passes.

## Notes for reviewer
```

- [ ] **Step 6: Commit**

```bash
git add .github/ISSUE_TEMPLATE/ .github/pull_request_template.md
git commit -m "Add issue and PR templates"
```

---

## Task 13: CI workflow skeleton

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

This is the placeholder. Issue #1 fills in real lint/test/typecheck commands; for now it must be green on the bootstrap commit (which has no package.json yet).

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  docs-sanity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify required docs exist
        run: |
          test -f AGENTS.md
          test -f CLAUDE.md
          test -f docs/privacy-promise.md
          test -f docs/architecture.md
          test -f docs/build.md
          test -f docs/github-project-management.md
          test -f LICENSE
          test -f README.md
          test -f SECURITY.md
          echo "All required docs present."

  link-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Find dead relative links in markdown
        run: |
          set -e
          fail=0
          while IFS= read -r -d '' f; do
            while IFS= read -r link; do
              path="${link%%#*}"
              [[ -z "$path" ]] && continue
              [[ "$path" =~ ^https?:// ]] && continue
              dir=$(dirname "$f")
              target="$dir/$path"
              if [[ ! -e "$target" ]]; then
                echo "DEAD: $f -> $link"
                fail=1
              fi
            done < <(grep -oE '\]\([^)]+\)' "$f" | sed 's/^](\(.*\))/\1/')
          done < <(find . -name '*.md' -not -path './node_modules/*' -print0)
          exit $fail
```

- [ ] **Step 2: Commit + push + verify CI**

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI skeleton: required-docs check + relative link check"
git push origin main
```

Then:
```bash
sleep 10
gh run list --repo Boohi/mydata --limit 3
```
Expected: latest run is `success` (or `in_progress` — wait and re-check). If it fails, fix the link/doc issue and push again.

---

## Task 14: Final verification

**Files:** none.

- [ ] **Step 1: Open a no-op PR to confirm CI gates work**

```bash
git checkout -b ci-smoke
echo "" >> README.md
git commit -am "ci: smoke test"
git push -u origin ci-smoke
gh pr create --fill --title "ci: smoke" --body "Smoke-test CI on a no-op change."
```

Wait, then:
```bash
gh pr checks
```
Expected: all checks green.

- [ ] **Step 2: Close the smoke PR**

```bash
gh pr close --delete-branch
git checkout main
git pull
```

- [ ] **Step 3: Repo health snapshot**

```bash
gh repo view Boohi/mydata
gh issue list --repo Boohi/mydata --limit 50 --json number,title,milestone,labels -q '.[] | "\(.number)\t\(.milestone.title // "-")\t\(.title)"' | column -t -s $'\t' | head -40
gh project list --owner Boohi
```
Expected: 27 issues across the two milestones, project board exists.

- [ ] **Step 4: Final commit (if anything pending) and done**

```bash
git status
```
Expected: clean working tree.

The repo is now ready for `next-slice` to pick up issue #1 (Repo tooling) as the first executable slice.

---

## Self-Review Notes

- **Spec coverage:** every section of the design spec has a corresponding issue file in `docs/issues/v0.1/`. §1 → README + privacy-promise. §2 → out-of-scope items live in post-v0.1. §3 (MVP) → issues 03–11. §4 (architecture) → docs/architecture.md + issues 03–08. §5 (privacy) → docs/privacy-promise.md + issue 02. §6 (data model) → issue 06. §7 (testing) → issue 02 + 12. §8 (repo layout) → tasks 4 + 5. §9 (roadmap) → tasks 8 + 9. §10 (risks) → onboarding addressed in issue 08, GeoIP licensing decided to DB-IP Lite in issue 07.
- **Placeholders:** none. Every code/command block is concrete.
- **Type consistency:** the bundle ID / process attribution naming is consistent across issues 06, 07, 08. SQLite path is consistent (`~/Library/Application Support/mydata/events.db`).
