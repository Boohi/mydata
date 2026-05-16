# Building mydata from source

## Prerequisites

- macOS 13 (Ventura) or later.
- Xcode 15+ command-line tools: `xcode-select --install`
- Node.js 20+ and npm 10+.
- Rust toolchain (for Tauri 2): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Apple Developer account for signing the system extension. The Team ID goes in `scripts/signing.env` (gitignored).
- For repo-management scripts (`scripts/seed-issues.sh`): bash >= 4 (`brew install bash`) and `yq` (`brew install yq`). The default macOS bash 3.2 is too old.

## First-time setup

1. Clone the repo and install Node deps:
   ```bash
   npm install
   ```
2. Resolve Swift packages:
   ```bash
   swift package resolve --package-path apps/extension
   swift package resolve --package-path apps/daemon
   ```
3. Set up signing for the system extension (one-time):
   ```bash
   cp scripts/signing.env.example scripts/signing.env
   # Edit scripts/signing.env: paste your Apple Developer TEAM_ID and SIGNING_IDENTITY.
   ```
   The file is gitignored. The Team ID is the 10-character string under your name
   at https://developer.apple.com/account → Membership.

## Build

### Network extension (`apps/extension`)

Build the Swift library:

```bash
swift build --package-path apps/extension
```

Run the unit tests:

```bash
swift test --package-path apps/extension
```

Packaging the `.systemextension` bundle (Info.plist + entitlements + binary)
and notarization are handled by the release pipeline (issue #26). For dev loading
on your local Mac, see "Loading the extension in dev mode" below.

### Daemon (`apps/daemon`)

```bash
swift build --package-path apps/daemon
swift test  --package-path apps/daemon
```

### UI (`apps/ui`)

```bash
npm run -w apps/ui dev
```

## Loading the extension in dev mode

> Requires `scripts/signing.env` to be filled in and the extension bundle to be
> assembled. Bundle assembly is automated by the release pipeline (issue #26).
> Until that lands, you can stage a bundle by hand:
>
> 1. Create a `MydataExtension.systemextension/` directory with `Contents/Info.plist`
>    (copy `apps/extension/Bundle/Info.plist`) and `Contents/MacOS/MydataExtension`
>    (the binary produced by `swift build`).
> 2. Sign it: `scripts/sign.sh path/to/MydataExtension.systemextension`.

Once you have a signed bundle:

```bash
# Activate (will prompt the user to approve in System Settings → Privacy & Security).
systemextensionsctl install path/to/MydataExtension.systemextension

# Verify it's loaded.
systemextensionsctl list

# Tail the extension's log stream in another terminal.
log stream --predicate 'subsystem == "io.mydata.extension"'

# Open a website in your browser. You should see "phase=start ..." lines.
```

To unload during development:

```bash
systemextensionsctl uninstall <team-id> io.mydata.extension
```

## Sign and notarize

(Release-pipeline details land in issue #26.)
