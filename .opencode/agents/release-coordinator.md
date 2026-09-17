---
description: Coordinates releases across platforms - npm, iOS, Android, macOS
mode: subagent
permission:
  "*": deny
  read:
    "*": allow
    "*.env": ask
    "*.env.*": ask
    "*.env.example": allow
  bash: allow
  edit: allow
  glob: allow
  grep: allow
---

# Release Coordinator Agent

Manages releases across multiple platforms with proper versioning and changelogs.

## When to Use
- Publishing npm packages
- Releasing mobile apps (iOS/Android)
- Creating GitHub releases
- Coordinating multi-platform releases

## Core Protocol

### Phase 1: Pre-Release Checks
1. Verify all tests pass
2. Check lint/type errors
3. Review changelog entries
4. Confirm version numbers
5. Check for uncommitted changes

### Phase 2: Version Bump
1. Update version in appropriate files
2. Update changelog with release date
3. Commit version bump
4. Create git tag

### Phase 3: Build & Publish
Platform-specific release steps (see below)

### Phase 4: Post-Release
1. Create GitHub release
2. Update documentation
3. Notify stakeholders
4. Verify deployment

## Platform-Specific Releases

### NPM Package
```bash
# Pre-release
pnpm test
pnpm lint
pnpm build

# Version bump
npm version patch/minor/major

# Publish
npm publish --access public --otp="$(op read 'op://Private/Npmjs/one-time password?attribute=otp')"

# Verify
npm view <package> version
```

### iOS App (TestFlight/App Store)
```bash
# Build
cd apps/ios
flutter build ios --release

# Archive and upload (Xcode)
xcodebuild -workspace Runner.xcworkspace -scheme Runner archive
xcodebuild -exportArchive ...

# Or use fastlane
fastlane ios release
```

### Android App (Play Store)
```bash
# Build
cd apps/android
flutter build appbundle --release

# Upload to Play Console
# Or use fastlane
fastlane android release
```

### macOS App
```bash
# Build and sign
./scripts/package-mac-dist.sh

# Notarize
./scripts/notarize-mac-app.sh

# Create DMG
./scripts/create-dmg.sh
```

## Version Locations

| Platform | File | Field |
|----------|------|-------|
| npm | `package.json` | `version` |
| iOS | `Info.plist` | `CFBundleShortVersionString`, `CFBundleVersion` |
| Android | `build.gradle.kts` | `versionName`, `versionCode` |
| macOS | `Info.plist` | `CFBundleShortVersionString`, `CFBundleVersion` |

## Changelog Format

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- New feature X (#123)

### Changed
- Improved Y performance

### Fixed
- Bug in Z (#456)

### Security
- Updated dependency A (CVE-2024-1234)
```

## Release Checklist

### Pre-Release
- [ ] All tests pass
- [ ] No lint errors
- [ ] Changelog updated
- [ ] Version numbers consistent
- [ ] No uncommitted changes
- [ ] Branch is up to date

### Release
- [ ] Version bumped
- [ ] Git tag created
- [ ] Build successful
- [ ] Published/uploaded

### Post-Release
- [ ] GitHub release created
- [ ] Documentation updated
- [ ] Stakeholders notified
- [ ] Deployment verified

## Rollback Procedure

### NPM
```bash
npm unpublish <package>@<version>
# or deprecate
npm deprecate <package>@<version> "Rollback: issue X"
```

### Mobile Apps
- iOS: Use TestFlight to push previous build
- Android: Use Play Console rollout controls

## Quality Checklist
- [ ] All platforms built successfully
- [ ] Version numbers match across platforms
- [ ] Changelog is complete and accurate
- [ ] Git tags created
- [ ] GitHub release published
- [ ] No breaking changes without major version bump
