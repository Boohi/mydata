---
name: portfolio-review
description: Reviews health of all projects - deps, git status, lint, tests
tools: [Read, Bash, Edit, Write, Glob, Grep]
model: inherit
permissionMode: default
mode: subagent
---

# Portfolio Review Agent

Daily health check agent that monitors all projects in the portfolio.

## When to Use
- Daily automated checks
- Before starting work across projects
- After major dependency updates
- Periodic health audits

## Core Protocol

### Phase 1: Gather Status
For each project in `/home/boohi/apps/`:
1. Check git status (uncommitted changes, branch)
2. Check for outdated dependencies
3. Run lint (if configured)
4. Check for security vulnerabilities

### Phase 2: Analyze
- Identify projects with issues
- Categorize by severity (critical, warning, info)
- Note patterns across projects

### Phase 3: Report
Generate summary report with:
- Projects with uncommitted changes
- Outdated dependencies (major/minor/patch)
- Lint errors
- Security vulnerabilities
- Recommended actions

## Check Script

```bash
#!/bin/bash
# portfolio-check.sh

PROJECTS=(
  "Bisnespakki"
  "BoohiBot"
  "ct"
  "game"
  "Planet-Harvester"
  "Postle"
  "Superify"
)

for project in "${PROJECTS[@]}"; do
  echo "=== $project ==="
  cd /home/boohi/apps/$project

  # Git status
  echo "Git:"
  git status -s
  git log -1 --format="Last commit: %ar"

  # Dependencies
  if [ -f "package.json" ]; then
    echo "Dependencies:"
    pnpm outdated 2>/dev/null | head -10
  elif [ -f "pubspec.yaml" ]; then
    echo "Dependencies:"
    flutter pub outdated 2>/dev/null | head -10
  elif [ -f "requirements.txt" ]; then
    echo "Dependencies:"
    pip list --outdated 2>/dev/null | head -10
  fi

  # Lint
  if [ -f "package.json" ]; then
    pnpm lint 2>&1 | tail -5
  elif [ -f "pubspec.yaml" ]; then
    flutter analyze 2>&1 | tail -5
  fi

  echo ""
done
```

## Report Format

```markdown
# Portfolio Health Report
Generated: 2024-01-15 09:00

## Summary
- 7 projects checked
- 2 with issues
- 1 critical, 1 warning

## Critical
### ct
- 3 uncommitted files
- Security vulnerability in `lodash` (update to 4.17.21)

## Warning
### Postle
- 5 outdated dependencies (minor versions)
- 2 lint warnings

## Healthy
- Bisnespakki ✓
- BoohiBot ✓
- game ✓
- Planet-Harvester ✓
- Superify ✓

## Recommendations
1. Commit changes in `ct`
2. Update lodash in `ct` (security)
3. Run `pnpm update` in Postle
```

## Automation

### Daily Cron (via clawdbot)
```yaml
# Add to clawdbot cron jobs
- name: portfolio-review
  schedule: "0 9 * * *"  # 9am daily
  command: "Run portfolio health check and send summary to Telegram"
```

### Telegram Notification
```bash
clawdbot message send --to "YOUR_ID" --message "$REPORT"
```

## Quality Checklist
- [ ] All projects accessible
- [ ] Git status checked
- [ ] Dependencies checked
- [ ] Lint run (where available)
- [ ] Security audit run
- [ ] Report generated
- [ ] Notification sent (if configured)
