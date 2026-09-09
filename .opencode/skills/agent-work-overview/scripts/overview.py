#!/usr/bin/env python3
"""Summarize local Codex and Claude Code work without reading secret state."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


PROCESS_RE = re.compile(r"^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$")
AGENT_COMMAND_RE = re.compile(
    r"(^|[\s/])(codex|claude)([\s/]|$)|claude-code|@anthropic-ai/claude-code",
    re.IGNORECASE,
)
SECRET_ASSIGN_RE = re.compile(
    r"\b([A-Za-z_][A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD|PASS|AUTH|COOKIE|CREDENTIAL)[A-Za-z0-9_]*)=([^\s]+)",
    re.IGNORECASE,
)
SECRET_FLAG_RE = re.compile(
    r"(?i)(--(?:api[-_]?key|token|secret|password|pass|auth|cookie|credential)(?:=|\s+))(\S+)"
)
TOKEN_RE = re.compile(
    r"\b(?:sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9_]{6,}|github_pat_[A-Za-z0-9_]+|xox[baprs]-[A-Za-z0-9-]{6,})\b"
)


def shorten(value: str, max_width: int = 160) -> str:
    value = " ".join(value.split())
    if len(value) <= max_width:
        return value
    return value[: max_width - 3] + "..."


def redact_command(command: str) -> str:
    command = SECRET_ASSIGN_RE.sub(lambda match: f"{match.group(1)}=[REDACTED]", command)
    command = SECRET_FLAG_RE.sub(lambda match: f"{match.group(1)}[REDACTED]", command)
    return TOKEN_RE.sub("[REDACTED]", command)


def is_agent_command(command: str) -> bool:
    lower = command.lower()
    if "agent-work-overview" in lower or "test_overview.py" in lower:
        return False
    if "grep " in lower and ("codex" in lower or "claude" in lower):
        return False
    return bool(AGENT_COMMAND_RE.search(command))


def parse_ps_output(lines: Iterable[str], self_pid: int | None = None) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    self_pid_text = str(self_pid) if self_pid is not None else None
    for line in lines:
        match = PROCESS_RE.match(line)
        if not match:
            continue
        pid, ppid, state, age, command = match.groups()
        if self_pid_text and pid == self_pid_text:
            continue
        if not is_agent_command(command):
            continue
        rows.append(
            {
                "pid": pid,
                "ppid": ppid,
                "state": state,
                "age": age,
                "command": shorten(redact_command(command)),
            }
        )
    return rows


def read_process_cwd(pid: str) -> str:
    proc_cwd = Path("/proc") / pid / "cwd"
    try:
        return os.readlink(proc_cwd)
    except OSError:
        return "unknown"


def collect_live_processes() -> list[dict[str, str]]:
    try:
        result = subprocess.run(
            ["ps", "-eo", "pid=,ppid=,stat=,etime=,command="],
            check=True,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except (OSError, subprocess.SubprocessError):
        return []

    rows = parse_ps_output(result.stdout.splitlines(), self_pid=os.getpid())
    for row in rows:
        row["cwd"] = read_process_cwd(row["pid"])
    return rows


def iso_mtime(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")


def find_recent_files(root: Path, pattern: str, limit: int) -> list[Path]:
    if not root.exists():
        return []
    try:
        files = [path for path in root.rglob(pattern) if path.is_file()]
    except OSError:
        return []
    files.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    return files[:limit]


def first_json_object(path: Path, wanted_type: str | None = None) -> dict | None:
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for index, line in enumerate(handle):
                if index >= 25:
                    break
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if wanted_type is None or data.get("type") == wanted_type:
                    return data
    except OSError:
        return None
    return None


def collect_codex_sessions(codex_home: Path, limit: int) -> list[dict[str, str]]:
    sessions_root = codex_home / "sessions"
    sessions: list[dict[str, str]] = []
    for path in find_recent_files(sessions_root, "*.jsonl", limit):
        data = first_json_object(path, wanted_type="session_meta")
        payload = data.get("payload", {}) if data else {}
        sessions.append(
            {
                "file": str(path),
                "modified": iso_mtime(path),
                "timestamp": str(data.get("timestamp", "")) if data else "",
                "id": str(payload.get("id", "")),
                "cwd": str(payload.get("cwd", "")),
                "originator": str(payload.get("originator", "")),
                "cli_version": str(payload.get("cli_version", "")),
                "model_provider": str(payload.get("model_provider", "")),
            }
        )
    return sessions


def collect_claude_sessions(claude_home: Path, limit: int) -> list[dict[str, str]]:
    projects_root = claude_home / "projects"
    search_root = projects_root if projects_root.exists() else claude_home
    sessions: list[dict[str, str]] = []
    for path in find_recent_files(search_root, "*.jsonl", limit):
        data = first_json_object(path)
        sessions.append(
            {
                "file": str(path),
                "modified": iso_mtime(path),
                "project": path.parent.name,
                "summary": shorten(str(data.get("summary", "") if data else ""), 120),
            }
        )
    return sessions


def git_summary(path: Path) -> dict[str, str] | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(path), "status", "--short", "--branch"],
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    lines = [line for line in result.stdout.splitlines() if line.strip()]
    branch = lines[0].removeprefix("## ") if lines else "unknown"
    dirty = max(0, len(lines) - 1)
    return {"branch": branch, "dirty": str(dirty)}


def collect_codex_worktrees(codex_home: Path, limit: int) -> list[dict[str, str]]:
    base = codex_home / "worktrees"
    if not base.exists():
        return []

    candidates: list[Path] = []
    try:
        for shard in base.iterdir():
            if not shard.is_dir():
                continue
            for child in shard.iterdir():
                if child.is_dir():
                    candidates.append(child)
    except OSError:
        return []

    candidates.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    worktrees: list[dict[str, str]] = []
    for path in candidates[:limit]:
        summary = git_summary(path)
        worktrees.append(
            {
                "path": str(path),
                "modified": iso_mtime(path),
                "branch": summary["branch"] if summary else "not a git worktree",
                "dirty": summary["dirty"] if summary else "unknown",
            }
        )
    return worktrees


def collect_agent_logs(codex_home: Path, limit: int) -> list[dict[str, str]]:
    logs_root = codex_home / "agent-logs"
    logs: list[dict[str, str]] = []
    for path in find_recent_files(logs_root, "*.final.md", limit):
        first_line = ""
        try:
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                for line in handle:
                    stripped = line.strip()
                    if stripped:
                        first_line = shorten(stripped.lstrip("# "), 120)
                        break
        except OSError:
            first_line = ""
        logs.append({"file": str(path), "modified": iso_mtime(path), "summary": first_line})
    return logs


def collect_tmux_sessions() -> list[dict[str, str]]:
    if not shutil.which("tmux"):
        return []
    try:
        result = subprocess.run(
            ["tmux", "list-sessions", "-F", "#{session_name}|#{session_windows}|#{session_attached}"],
            check=True,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return []

    sessions: list[dict[str, str]] = []
    for line in result.stdout.splitlines():
        parts = line.split("|")
        if len(parts) != 3:
            continue
        sessions.append({"name": parts[0], "windows": parts[1], "attached": parts[2]})
    return sessions


# ---------------------------------------------------------------------------
# Filter helpers
# ---------------------------------------------------------------------------


def _substr(value: str, needle: str) -> bool:
    """Case-insensitive substring match."""
    return needle.lower() in value.lower()


def filter_processes(
    rows: list[dict[str, str]],
    *,
    path_filter: str | None,
    recent_cutoff: datetime | None,
) -> list[dict[str, str]]:
    result = []
    for row in rows:
        if path_filter and not _substr(row.get("cwd", ""), path_filter):
            continue
        # Processes have no ISO modified timestamp; skip recent_cutoff for them.
        result.append(row)
    return result


def filter_worktrees(
    rows: list[dict[str, str]],
    *,
    path_filter: str | None,
    branch_filter: str | None,
    issue_filter: str | None,
    dirty_only: bool,
    recent_cutoff: datetime | None,
) -> list[dict[str, str]]:
    result = []
    for row in rows:
        if path_filter and not _substr(row.get("path", ""), path_filter):
            continue
        if branch_filter and not _substr(row.get("branch", ""), branch_filter):
            continue
        if issue_filter and not _substr(row.get("branch", ""), issue_filter):
            continue
        if dirty_only:
            try:
                if int(row.get("dirty", "0")) == 0:
                    continue
            except ValueError:
                # "unknown" dirty count — include it when dirty_only is set
                pass
        if recent_cutoff:
            modified_str = row.get("modified", "")
            try:
                modified_dt = datetime.fromisoformat(modified_str)
                if modified_dt < recent_cutoff:
                    continue
            except ValueError:
                pass
        result.append(row)
    return result


def filter_sessions(
    rows: list[dict[str, str]],
    *,
    path_filter: str | None,
    issue_filter: str | None,
    recent_cutoff: datetime | None,
    path_fields: tuple[str, ...] = ("cwd", "file"),
) -> list[dict[str, str]]:
    result = []
    for row in rows:
        if path_filter:
            if not any(_substr(row.get(f, ""), path_filter) for f in path_fields):
                continue
        if issue_filter:
            if not any(_substr(row.get(f, ""), issue_filter) for f in path_fields):
                continue
        if recent_cutoff:
            modified_str = row.get("modified", "")
            try:
                modified_dt = datetime.fromisoformat(modified_str)
                if modified_dt < recent_cutoff:
                    continue
            except ValueError:
                pass
        result.append(row)
    return result


def filter_agent_logs(
    rows: list[dict[str, str]],
    *,
    path_filter: str | None,
    issue_filter: str | None,
    recent_cutoff: datetime | None,
) -> list[dict[str, str]]:
    result = []
    for row in rows:
        if path_filter and not _substr(row.get("file", ""), path_filter):
            continue
        if issue_filter and not _substr(row.get("file", ""), issue_filter):
            continue
        if recent_cutoff:
            modified_str = row.get("modified", "")
            try:
                modified_dt = datetime.fromisoformat(modified_str)
                if modified_dt < recent_cutoff:
                    continue
            except ValueError:
                pass
        result.append(row)
    return result


def apply_filters(
    snapshot: dict,
    *,
    path_filter: str | None = None,
    branch_filter: str | None = None,
    issue_filter: str | None = None,
    dirty_only: bool = False,
    recent_hours: float | None = None,
) -> dict:
    """Return a shallow copy of snapshot with filter criteria applied to all sections."""
    recent_cutoff: datetime | None = None
    if recent_hours is not None:
        generated_str = snapshot.get("generated", "")
        try:
            generated_dt = datetime.fromisoformat(generated_str)
        except ValueError:
            generated_dt = datetime.now(timezone.utc)
        recent_cutoff = generated_dt - timedelta(hours=recent_hours)

    processes = filter_processes(
        snapshot.get("processes", []),
        path_filter=path_filter,
        recent_cutoff=recent_cutoff,
    )

    worktrees = filter_worktrees(
        snapshot.get("codex_worktrees", []),
        path_filter=path_filter,
        branch_filter=branch_filter,
        issue_filter=issue_filter,
        dirty_only=dirty_only,
        recent_cutoff=recent_cutoff,
    )

    codex_sessions = filter_sessions(
        snapshot.get("codex_sessions", []),
        path_filter=path_filter,
        issue_filter=issue_filter,
        recent_cutoff=recent_cutoff,
        path_fields=("cwd", "file"),
    )

    claude_sessions = filter_sessions(
        snapshot.get("claude_sessions", []),
        path_filter=path_filter,
        issue_filter=issue_filter,
        recent_cutoff=recent_cutoff,
        path_fields=("file", "project"),
    )

    agent_logs = filter_agent_logs(
        snapshot.get("agent_logs", []),
        path_filter=path_filter,
        issue_filter=issue_filter,
        recent_cutoff=recent_cutoff,
    )

    filtered = dict(snapshot)
    filtered["processes"] = processes
    filtered["processes_total"] = len(processes)
    filtered["processes_more"] = 0  # limit already applied before filtering
    filtered["codex_worktrees"] = worktrees
    filtered["codex_sessions"] = codex_sessions
    filtered["claude_sessions"] = claude_sessions
    filtered["agent_logs"] = agent_logs
    # tmux sessions are not filtered (no path/branch metadata available)
    return filtered


def collect_snapshot(
    codex_home: Path,
    claude_home: Path,
    limit: int,
    now: datetime | None = None,
    process_rows: list[dict[str, str]] | None = None,
) -> dict:
    current_time = now or datetime.now(timezone.utc)
    processes = collect_live_processes() if process_rows is None else process_rows
    return {
        "generated": current_time.isoformat(timespec="seconds"),
        "codex_home": str(codex_home),
        "claude_home": str(claude_home),
        "processes": processes[:limit],
        "processes_total": len(processes),
        "processes_more": max(0, len(processes) - limit),
        "codex_worktrees": collect_codex_worktrees(codex_home, limit),
        "codex_sessions": collect_codex_sessions(codex_home, limit),
        "claude_sessions": collect_claude_sessions(claude_home, limit),
        "agent_logs": collect_agent_logs(codex_home, limit),
        "tmux_sessions": collect_tmux_sessions(),
    }


def render_report(snapshot: dict, *, compact: bool = False) -> str:
    if compact:
        return _render_compact(snapshot)
    return _render_full(snapshot)


def _render_full(snapshot: dict) -> str:
    lines: list[str] = [
        "# Agent Work Overview",
        "",
        f"Generated: {snapshot['generated']}",
        f"Codex home: `{snapshot['codex_home']}`",
        f"Claude home: `{snapshot['claude_home']}`",
        "",
        "## Live agent processes",
    ]

    processes = snapshot["processes"]
    if processes:
        for row in processes:
            cwd = row.get("cwd", "unknown")
            lines.append(
                f"- PID {row['pid']} age {row['age']} state {row['state']} cwd `{cwd}`: `{row['command']}`"
            )
        if snapshot.get("processes_more", 0):
            lines.append(f"- {snapshot['processes_more']} more matching processes not shown. Increase `--limit` to see them.")
    else:
        lines.append("No matching live agent processes found.")

    lines.extend(["", "## Codex worktrees"])
    worktrees = snapshot["codex_worktrees"]
    if worktrees:
        for row in worktrees:
            lines.append(
                f"- `{row['path']}` modified {row['modified']} branch `{row['branch']}` dirty files {row['dirty']}"
            )
    else:
        lines.append("No Codex worktrees found.")

    lines.extend(["", "## Recent Codex sessions"])
    codex_sessions = snapshot["codex_sessions"]
    if codex_sessions:
        for row in codex_sessions:
            cwd = row["cwd"] or "unknown cwd"
            origin = row["originator"] or "unknown origin"
            version = f" cli {row['cli_version']}" if row["cli_version"] else ""
            lines.append(f"- {row['modified']} {origin}{version} cwd `{cwd}` file `{row['file']}`")
    else:
        lines.append("No recent Codex session files found.")

    lines.extend(["", "## Recent Claude Code sessions"])
    claude_sessions = snapshot["claude_sessions"]
    if claude_sessions:
        for row in claude_sessions:
            summary = f" summary `{row['summary']}`" if row["summary"] else ""
            lines.append(f"- {row['modified']} project `{row['project']}` file `{row['file']}`{summary}")
    else:
        lines.append("No recent Claude Code session files found.")

    lines.extend(["", "## Finished agent logs"])
    agent_logs = snapshot["agent_logs"]
    if agent_logs:
        for row in agent_logs:
            summary = f" - {row['summary']}" if row["summary"] else ""
            lines.append(f"- {row['modified']} `{row['file']}`{summary}")
    else:
        lines.append("No finished agent logs found.")

    lines.extend(["", "## Terminal job containers"])
    tmux_sessions = snapshot["tmux_sessions"]
    if tmux_sessions:
        for row in tmux_sessions:
            lines.append(f"- tmux `{row['name']}` windows {row['windows']} attached {row['attached']}")
    else:
        lines.append("No tmux sessions found or tmux is unavailable.")

    lines.extend(
        [
            "",
            "## Next-slice handoff",
            "Run this before `next-slice`. If a live process, recent session, or dirty worktree overlaps the intended issue, inspect that work before starting another PR path.",
        ]
    )
    return "\n".join(lines) + "\n"


def _render_compact(snapshot: dict) -> str:
    """One-liner summary per section; suppresses empty sections."""
    parts: list[str] = [f"Agent Work Overview @ {snapshot['generated']}"]

    processes = snapshot["processes"]
    if processes:
        parts.append(f"processes({len(processes)}): " + "; ".join(
            f"PID {r['pid']} {r['age']} cwd {r.get('cwd', '?')}" for r in processes
        ))

    worktrees = snapshot["codex_worktrees"]
    if worktrees:
        parts.append(f"worktrees({len(worktrees)}): " + "; ".join(
            f"{r['path']} [{r['branch']}] dirty={r['dirty']}" for r in worktrees
        ))

    codex_sessions = snapshot["codex_sessions"]
    if codex_sessions:
        parts.append(f"codex-sessions({len(codex_sessions)}): " + "; ".join(
            r["cwd"] or r["file"] for r in codex_sessions
        ))

    claude_sessions = snapshot["claude_sessions"]
    if claude_sessions:
        parts.append(f"claude-sessions({len(claude_sessions)}): " + "; ".join(
            r["project"] for r in claude_sessions
        ))

    agent_logs = snapshot["agent_logs"]
    if agent_logs:
        parts.append(f"agent-logs({len(agent_logs)}): " + "; ".join(
            r.get("summary", r["file"]) for r in agent_logs
        ))

    tmux_sessions = snapshot["tmux_sessions"]
    if tmux_sessions:
        parts.append(f"tmux({len(tmux_sessions)}): " + "; ".join(
            r["name"] for r in tmux_sessions
        ))

    return "\n".join(parts) + "\n"


def build_report(
    codex_home: Path,
    claude_home: Path,
    limit: int,
    now: datetime | None = None,
    process_rows: list[dict[str, str]] | None = None,
    *,
    path_filter: str | None = None,
    branch_filter: str | None = None,
    issue_filter: str | None = None,
    dirty_only: bool = False,
    recent_hours: float | None = None,
    compact: bool = False,
) -> str:
    snapshot = collect_snapshot(codex_home, claude_home, limit, now=now, process_rows=process_rows)
    if path_filter or branch_filter or issue_filter or dirty_only or recent_hours is not None:
        snapshot = apply_filters(
            snapshot,
            path_filter=path_filter,
            branch_filter=branch_filter,
            issue_filter=issue_filter,
            dirty_only=dirty_only,
            recent_hours=recent_hours,
        )
    return render_report(snapshot, compact=compact)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarize local Codex and Claude Code work.")
    parser.add_argument("--limit", type=int, default=12, help="Maximum rows per history section.")
    parser.add_argument(
        "--codex-home",
        default=os.environ.get("CODEX_HOME", "~/.codex"),
        help="Codex state directory.",
    )
    parser.add_argument(
        "--claude-home",
        default=os.environ.get("CLAUDE_HOME", "~/.claude"),
        help="Claude Code state directory.",
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    # Filters
    parser.add_argument(
        "--cwd", "--path",
        dest="path_filter",
        metavar="SUBSTR",
        help="Limit results to items whose path/cwd contains SUBSTR (case-insensitive).",
    )
    parser.add_argument(
        "--branch",
        dest="branch_filter",
        metavar="SUBSTR",
        help="Limit worktrees to those whose branch name contains SUBSTR.",
    )
    parser.add_argument(
        "--issue",
        dest="issue_filter",
        metavar="SUBSTR",
        help="Limit results to items whose branch/file path contains SUBSTR (use issue number or key).",
    )
    parser.add_argument(
        "--dirty",
        action="store_true",
        help="Show only worktrees that have uncommitted changes.",
    )
    parser.add_argument(
        "--recent-hours",
        type=float,
        metavar="N",
        help="Show only items modified within the last N hours.",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Compact one-liner output; suppresses empty sections.",
    )
    args = parser.parse_args(argv)

    codex_home = Path(args.codex_home).expanduser()
    claude_home = Path(args.claude_home).expanduser()

    path_filter: str | None = args.path_filter
    branch_filter: str | None = args.branch_filter
    issue_filter: str | None = args.issue_filter
    dirty_only: bool = args.dirty
    recent_hours: float | None = args.recent_hours
    compact: bool = args.compact

    snapshot = collect_snapshot(codex_home, claude_home, max(1, args.limit))
    if path_filter or branch_filter or issue_filter or dirty_only or recent_hours is not None:
        snapshot = apply_filters(
            snapshot,
            path_filter=path_filter,
            branch_filter=branch_filter,
            issue_filter=issue_filter,
            dirty_only=dirty_only,
            recent_hours=recent_hours,
        )

    if args.json:
        print(json.dumps(snapshot, indent=2, sort_keys=True))
    else:
        print(render_report(snapshot, compact=compact), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
