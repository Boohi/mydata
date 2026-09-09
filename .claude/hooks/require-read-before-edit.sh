#!/bin/bash
# Hook: require-read-before-edit.sh
# Type: PreToolUse (Edit, Write)
# Purpose: Advisory nudge to Read a file before editing it.
#
# Editing/writing a file that exists on disk without having Read it this
# session is a common, deterministic error. This hook emits an advisory
# reminder (to stderr) when the target file exists but no prior Read of it
# is found in the session transcript.
#
# FAIL-SAFE: this hook never hard-blocks. It always exits 0. On any missing
# data or parse failure it stays silent. The message is an advisory nudge,
# not an enforcement gate.

HOOK_PAYLOAD="$(cat)"

# Nothing to do without a payload.
if [[ -z "$HOOK_PAYLOAD" ]]; then
  exit 0
fi

# Need python3 to parse JSON safely; bail out (allow) otherwise.
if ! command -v python3 >/dev/null 2>&1; then
  exit 0
fi

ADVISORY="$(HOOK_PAYLOAD="$HOOK_PAYLOAD" python3 - <<'PY'
import json
import os
import sys

try:
    raw = os.environ.get("HOOK_PAYLOAD", "")
    data = json.loads(raw) if raw.strip() else {}
except Exception:
    sys.exit(0)

if not isinstance(data, dict):
    sys.exit(0)

tool_name = data.get("tool_name", "")
if tool_name not in ("Edit", "Write"):
    sys.exit(0)

tool_input = data.get("tool_input", {})
if not isinstance(tool_input, dict):
    sys.exit(0)

target = tool_input.get("file_path") or tool_input.get("filePath")
if not target:
    sys.exit(0)

# New files (not yet on disk) do not need a prior Read.
if not os.path.exists(target):
    sys.exit(0)

abs_target = os.path.abspath(target)
base_target = os.path.basename(abs_target)

transcript_path = data.get("transcript_path", "")
if not transcript_path or not os.path.exists(transcript_path):
    # No transcript evidence available; fail-safe (no nudge).
    sys.exit(0)

def read_paths_from_transcript(path):
    paths = set()
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                message = obj.get("message", {}) if isinstance(obj, dict) else {}
                content = message.get("content") if isinstance(message, dict) else None
                if not isinstance(content, list):
                    continue
                for c in content:
                    if not isinstance(c, dict):
                        continue
                    if c.get("type") != "tool_use":
                        continue
                    if c.get("name") != "Read":
                        continue
                    inp = c.get("input", {})
                    if not isinstance(inp, dict):
                        continue
                    fp = inp.get("file_path") or inp.get("filePath")
                    if fp:
                        paths.add(fp)
    except Exception:
        return None
    return paths

read_paths = read_paths_from_transcript(transcript_path)
if read_paths is None:
    # Could not read transcript; fail-safe (no nudge).
    sys.exit(0)

for fp in read_paths:
    try:
        if os.path.abspath(fp) == abs_target:
            sys.exit(0)
    except Exception:
        pass
    if os.path.basename(fp) == base_target:
        sys.exit(0)

print(target)
PY
)" || exit 0

if [[ -n "$ADVISORY" ]]; then
  echo "ADVISORY: '$ADVISORY' exists but no Read of it was found this session." >&2
  echo "Read the file first so your edit matches its current contents." >&2
fi

# Advisory only: never block.
exit 0
