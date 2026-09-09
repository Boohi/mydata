#!/bin/bash
# Hook: team-task-completed-gate.sh
# Type: TaskCompleted
# Purpose: Team quality gate before accepting teammate task completion

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
HOOK_PAYLOAD="$(cat)"

if [[ ! -d "$PROJECT_DIR" ]]; then
  exit 0
fi

cd "$PROJECT_DIR" || exit 0

if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

changed_files() {
  python3 - <<'PY'
import subprocess

try:
    raw = subprocess.check_output(["git", "status", "--porcelain=1", "-z"])
except Exception:
    print("")
    raise SystemExit(0)

parts = raw.decode("utf-8", "replace").split("\0")
files = []
for part in parts:
    if not part:
        continue
    path = part[3:] if len(part) > 3 else ""
    if " -> " in path:
        path = path.split(" -> ", 1)[1]
    if path:
        files.append(path)

seen = set()
for file in files:
    if file in seen:
        continue
    seen.add(file)
    print(file)
PY
}

mapfile -t CHANGED < <(changed_files)

if [[ ${#CHANGED[@]} -eq 0 ]]; then
  exit 0
fi

# Block unresolved merge conflicts immediately.
if git diff --name-only --diff-filter=U | grep -q .; then
  echo "BLOCKED: unresolved merge conflicts exist. Resolve conflicts before completing teammate task." >&2
  exit 2
fi

if command -v rg >/dev/null 2>&1; then
  conflict_hits="$(rg -n '^(<<<<<<<|=======|>>>>>>>)' "${CHANGED[@]}" 2>/dev/null || true)"
else
  conflict_hits=""
fi

if [[ -n "$conflict_hits" ]]; then
  echo "BLOCKED: conflict markers found in changed files:" >&2
  echo "$conflict_hits" >&2
  exit 2
fi

# Validate shell syntax for changed shell scripts.
for file in "${CHANGED[@]}"; do
  if [[ "$file" == *.sh && -f "$file" ]]; then
    if ! bash -n "$file" >/dev/null 2>&1; then
      echo "BLOCKED: shell syntax check failed: $file" >&2
      exit 2
    fi
  fi
done

# Validate changed JSON files are parseable.
if command -v node >/dev/null 2>&1; then
  for file in "${CHANGED[@]}"; do
    if [[ "$file" == *.json && -f "$file" ]]; then
      if ! node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$file" >/dev/null 2>&1; then
        echo "BLOCKED: invalid JSON detected: $file" >&2
        exit 2
      fi
    fi
  done
fi

exit 0
