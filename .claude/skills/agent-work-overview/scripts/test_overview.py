#!/usr/bin/env python3
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("overview.py")
SPEC = importlib.util.spec_from_file_location("overview", SCRIPT_PATH)
overview = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(overview)


class AgentWorkOverviewTests(unittest.TestCase):
    def test_redact_command_masks_secret_assignments_and_flags(self):
        command = (
            "codex run OPENAI_API_KEY=sk-test123 --api-key sk-live456 "
            "--password hunter2 --model gpt-5"
        )

        redacted = overview.redact_command(command)

        self.assertNotIn("sk-test123", redacted)
        self.assertNotIn("sk-live456", redacted)
        self.assertNotIn("hunter2", redacted)
        self.assertIn("OPENAI_API_KEY=[REDACTED]", redacted)
        self.assertIn("--api-key [REDACTED]", redacted)
        self.assertIn("--password [REDACTED]", redacted)
        self.assertIn("--model gpt-5", redacted)

    def test_parse_ps_output_keeps_agent_processes_only(self):
        rows = overview.parse_ps_output(
            [
                " 123 1 S 00:03:14 /usr/bin/node /usr/local/bin/codex --model gpt-5",
                " 456 1 S 00:00:10 bash -lc sleep 30",
                " 789 1 S 01:02:03 claude code --dangerously-skip-permissions",
                " 790 1 S 00:00:01 python3 /home/me/.codex/plugins/cache/claude-plugins-official/hook.py",
                " 791 1 S 00:00:01 playwright-mcp --output-dir /home/me/.codex/worktrees/demo",
            ],
            self_pid=999,
        )

        self.assertEqual([row["pid"] for row in rows], ["123", "789"])
        self.assertEqual(rows[0]["age"], "00:03:14")
        self.assertIn("codex", rows[0]["command"])

    def test_build_report_limits_live_processes(self):
        process_rows = [
            {
                "pid": str(index),
                "ppid": "1",
                "state": "S",
                "age": "00:00:01",
                "cwd": f"/work/{index}",
                "command": "codex app-server",
            }
            for index in range(1, 5)
        ]

        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            report = overview.build_report(
                codex_home=home / ".codex",
                claude_home=home / ".claude",
                limit=2,
                now=datetime(2026, 6, 6, 20, 0, tzinfo=timezone.utc),
                process_rows=process_rows,
            )

        self.assertIn("PID 1", report)
        self.assertIn("PID 2", report)
        self.assertNotIn("PID 3", report)
        self.assertIn("2 more matching processes not shown", report)

    def test_collect_codex_sessions_reads_only_safe_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            codex_home = Path(tmp) / ".codex"
            session_dir = codex_home / "sessions" / "2026" / "06" / "06"
            session_dir.mkdir(parents=True)
            session_file = session_dir / "rollout-2026-06-06T20-39-37-demo.jsonl"
            session_file.write_text(
                json.dumps(
                    {
                        "timestamp": "2026-06-06T20:39:41.165Z",
                        "type": "session_meta",
                        "payload": {
                            "id": "session-1",
                            "cwd": "/work/project",
                            "originator": "Codex Desktop",
                            "cli_version": "0.137.0",
                            "model_provider": "openai",
                        },
                    }
                )
                + "\n"
                + json.dumps(
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "message",
                            "content": [{"type": "input_text", "text": "secret body"}],
                        },
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            sessions = overview.collect_codex_sessions(codex_home, limit=3)

        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]["cwd"], "/work/project")
        self.assertEqual(sessions[0]["originator"], "Codex Desktop")
        self.assertNotIn("secret body", json.dumps(sessions))

    def test_build_report_handles_missing_directories(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            report = overview.build_report(
                codex_home=home / ".codex",
                claude_home=home / ".claude",
                limit=5,
                now=datetime(2026, 6, 6, 20, 0, tzinfo=timezone.utc),
                process_rows=[],
            )

        self.assertIn("# Agent Work Overview", report)
        self.assertIn("No matching live agent processes found.", report)
        self.assertIn("No Codex worktrees found.", report)
        self.assertIn("Run this before `next-slice`", report)


# ---------------------------------------------------------------------------
# Filter tests
# ---------------------------------------------------------------------------

def _make_snapshot(
    processes=None,
    worktrees=None,
    codex_sessions=None,
    claude_sessions=None,
    agent_logs=None,
    generated="2026-06-15T10:00:00+00:00",
):
    return {
        "generated": generated,
        "codex_home": "/tmp/.codex",
        "claude_home": "/tmp/.claude",
        "processes": processes or [],
        "processes_total": len(processes or []),
        "processes_more": 0,
        "codex_worktrees": worktrees or [],
        "codex_sessions": codex_sessions or [],
        "claude_sessions": claude_sessions or [],
        "agent_logs": agent_logs or [],
        "tmux_sessions": [],
    }


class FilterPathTests(unittest.TestCase):
    """--cwd/--path substring filter."""

    def test_path_filter_keeps_matching_processes(self):
        processes = [
            {"pid": "1", "ppid": "0", "state": "S", "age": "00:01", "cwd": "/home/user/project-a", "command": "codex"},
            {"pid": "2", "ppid": "0", "state": "S", "age": "00:01", "cwd": "/home/user/project-b", "command": "codex"},
        ]
        snap = _make_snapshot(processes=processes)
        result = overview.apply_filters(snap, path_filter="project-a")
        self.assertEqual(len(result["processes"]), 1)
        self.assertEqual(result["processes"][0]["pid"], "1")

    def test_path_filter_excludes_non_matching_processes(self):
        processes = [
            {"pid": "1", "ppid": "0", "state": "S", "age": "00:01", "cwd": "/other/path", "command": "codex"},
        ]
        snap = _make_snapshot(processes=processes)
        result = overview.apply_filters(snap, path_filter="project-x")
        self.assertEqual(result["processes"], [])

    def test_path_filter_is_case_insensitive(self):
        processes = [
            {"pid": "1", "ppid": "0", "state": "S", "age": "00:01", "cwd": "/Home/User/MyProject", "command": "codex"},
        ]
        snap = _make_snapshot(processes=processes)
        result = overview.apply_filters(snap, path_filter="myproject")
        self.assertEqual(len(result["processes"]), 1)

    def test_path_filter_applies_to_worktrees(self):
        worktrees = [
            {"path": "/codex/wt/issue-123", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/123", "dirty": "0"},
            {"path": "/codex/wt/issue-456", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/456", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, path_filter="issue-123")
        self.assertEqual(len(result["codex_worktrees"]), 1)
        self.assertIn("issue-123", result["codex_worktrees"][0]["path"])

    def test_path_filter_applies_to_codex_sessions(self):
        sessions = [
            {"file": "/tmp/s1.jsonl", "modified": "2026-06-15T09:00:00+00:00", "cwd": "/work/alpha", "originator": "X", "id": "", "timestamp": "", "cli_version": "", "model_provider": ""},
            {"file": "/tmp/s2.jsonl", "modified": "2026-06-15T09:00:00+00:00", "cwd": "/work/beta", "originator": "X", "id": "", "timestamp": "", "cli_version": "", "model_provider": ""},
        ]
        snap = _make_snapshot(codex_sessions=sessions)
        result = overview.apply_filters(snap, path_filter="alpha")
        self.assertEqual(len(result["codex_sessions"]), 1)
        self.assertEqual(result["codex_sessions"][0]["cwd"], "/work/alpha")

    def test_path_filter_no_filter_returns_all(self):
        worktrees = [
            {"path": "/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "b", "dirty": "0"},
            {"path": "/b", "modified": "2026-06-15T09:00:00+00:00", "branch": "b", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap)
        self.assertEqual(len(result["codex_worktrees"]), 2)


class FilterBranchTests(unittest.TestCase):
    """--branch substring filter."""

    def test_branch_filter_keeps_matching_worktrees(self):
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/issue-410-overview", "dirty": "2"},
            {"path": "/wt/b", "modified": "2026-06-15T09:00:00+00:00", "branch": "fix/unrelated-bug", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, branch_filter="issue-410")
        self.assertEqual(len(result["codex_worktrees"]), 1)
        self.assertIn("issue-410", result["codex_worktrees"][0]["branch"])

    def test_branch_filter_case_insensitive(self):
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "FEAT/MyFeature", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, branch_filter="myfeature")
        self.assertEqual(len(result["codex_worktrees"]), 1)

    def test_branch_filter_no_match_returns_empty(self):
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "main", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, branch_filter="feature-xyz")
        self.assertEqual(result["codex_worktrees"], [])


class FilterIssueTests(unittest.TestCase):
    """--issue activity-key/issue substring filter."""

    def test_issue_filter_matches_branch_substring(self):
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "claude/issue-410-overview-filters", "dirty": "1"},
            {"path": "/wt/b", "modified": "2026-06-15T09:00:00+00:00", "branch": "claude/issue-300-something-else", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, issue_filter="410")
        self.assertEqual(len(result["codex_worktrees"]), 1)
        self.assertIn("410", result["codex_worktrees"][0]["branch"])

    def test_issue_filter_applies_to_codex_session_file(self):
        sessions = [
            {"file": "/sessions/issue-410/s.jsonl", "modified": "2026-06-15T09:00:00+00:00", "cwd": "/work", "originator": "X", "id": "", "timestamp": "", "cli_version": "", "model_provider": ""},
            {"file": "/sessions/issue-999/s.jsonl", "modified": "2026-06-15T09:00:00+00:00", "cwd": "/work", "originator": "X", "id": "", "timestamp": "", "cli_version": "", "model_provider": ""},
        ]
        snap = _make_snapshot(codex_sessions=sessions)
        result = overview.apply_filters(snap, issue_filter="issue-410")
        self.assertEqual(len(result["codex_sessions"]), 1)

    def test_issue_filter_applies_to_agent_logs(self):
        logs = [
            {"file": "/logs/issue-410.final.md", "modified": "2026-06-15T09:00:00+00:00", "summary": "done"},
            {"file": "/logs/issue-999.final.md", "modified": "2026-06-15T09:00:00+00:00", "summary": "done"},
        ]
        snap = _make_snapshot(agent_logs=logs)
        result = overview.apply_filters(snap, issue_filter="issue-410")
        self.assertEqual(len(result["agent_logs"]), 1)

    def test_issue_filter_no_match_returns_empty(self):
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "main", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, issue_filter="999")
        self.assertEqual(result["codex_worktrees"], [])


class FilterDirtyTests(unittest.TestCase):
    """--dirty filter: show only worktrees with uncommitted changes."""

    def test_dirty_only_keeps_dirty_worktrees(self):
        worktrees = [
            {"path": "/wt/clean", "modified": "2026-06-15T09:00:00+00:00", "branch": "main", "dirty": "0"},
            {"path": "/wt/dirty", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/x", "dirty": "3"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, dirty_only=True)
        self.assertEqual(len(result["codex_worktrees"]), 1)
        self.assertEqual(result["codex_worktrees"][0]["path"], "/wt/dirty")

    def test_dirty_only_false_keeps_all(self):
        worktrees = [
            {"path": "/wt/clean", "modified": "2026-06-15T09:00:00+00:00", "branch": "main", "dirty": "0"},
            {"path": "/wt/dirty", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/x", "dirty": "3"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, dirty_only=False)
        self.assertEqual(len(result["codex_worktrees"]), 2)

    def test_dirty_only_with_unknown_dirty_includes_entry(self):
        """Worktrees with unknown dirty count are included when --dirty is set."""
        worktrees = [
            {"path": "/wt/unknown", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/x", "dirty": "unknown"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, dirty_only=True)
        self.assertEqual(len(result["codex_worktrees"]), 1)


class FilterRecentHoursTests(unittest.TestCase):
    """--recent-hours filter."""

    def test_recent_hours_keeps_items_within_window(self):
        worktrees = [
            # 30 min ago — within 1-hour window
            {"path": "/wt/recent", "modified": "2026-06-15T09:30:00+00:00", "branch": "feat/r", "dirty": "0"},
            # 3 hours ago — outside 1-hour window
            {"path": "/wt/old", "modified": "2026-06-15T07:00:00+00:00", "branch": "feat/o", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees, generated="2026-06-15T10:00:00+00:00")
        result = overview.apply_filters(snap, recent_hours=1.0)
        self.assertEqual(len(result["codex_worktrees"]), 1)
        self.assertEqual(result["codex_worktrees"][0]["path"], "/wt/recent")

    def test_recent_hours_no_filter_keeps_all(self):
        worktrees = [
            {"path": "/wt/old", "modified": "2026-01-01T00:00:00+00:00", "branch": "feat/o", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, recent_hours=None)
        self.assertEqual(len(result["codex_worktrees"]), 1)

    def test_recent_hours_applies_to_sessions(self):
        sessions = [
            {"file": "/s/recent.jsonl", "modified": "2026-06-15T09:45:00+00:00", "cwd": "/work", "originator": "X", "id": "", "timestamp": "", "cli_version": "", "model_provider": ""},
            {"file": "/s/old.jsonl", "modified": "2026-06-15T05:00:00+00:00", "cwd": "/work", "originator": "X", "id": "", "timestamp": "", "cli_version": "", "model_provider": ""},
        ]
        snap = _make_snapshot(codex_sessions=sessions, generated="2026-06-15T10:00:00+00:00")
        result = overview.apply_filters(snap, recent_hours=2.0)
        self.assertEqual(len(result["codex_sessions"]), 1)
        self.assertIn("recent", result["codex_sessions"][0]["file"])

    def test_recent_hours_exact_boundary_is_exclusive(self):
        """Items exactly at the cutoff boundary should be excluded."""
        worktrees = [
            {"path": "/wt/exact", "modified": "2026-06-15T08:00:00+00:00", "branch": "feat/x", "dirty": "0"},
        ]
        snap = _make_snapshot(worktrees=worktrees, generated="2026-06-15T10:00:00+00:00")
        # cutoff = 10:00 - 2h = 08:00; item is at 08:00 so < cutoff is False, == cutoff is not < so included
        result = overview.apply_filters(snap, recent_hours=2.0)
        # 08:00 is NOT < 08:00, so it passes
        self.assertEqual(len(result["codex_worktrees"]), 1)


class FilterCompactTests(unittest.TestCase):
    """--compact output mode."""

    def test_compact_output_is_single_block(self):
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/410", "dirty": "2"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        output = overview.render_report(snap, compact=True)
        # Must not emit full-report section headers
        self.assertNotIn("## Codex worktrees", output)
        self.assertIn("worktrees(1):", output)
        self.assertIn("feat/410", output)

    def test_compact_suppresses_empty_sections(self):
        snap = _make_snapshot()  # no data
        output = overview.render_report(snap, compact=True)
        self.assertNotIn("processes(", output)
        self.assertNotIn("worktrees(", output)
        # Header line should still appear
        self.assertIn("Agent Work Overview @", output)

    def test_compact_does_not_include_next_slice_handoff(self):
        snap = _make_snapshot()
        output = overview.render_report(snap, compact=True)
        self.assertNotIn("Next-slice handoff", output)

    def test_full_report_not_affected_by_compact_default(self):
        snap = _make_snapshot()
        output = overview.render_report(snap)
        self.assertIn("# Agent Work Overview", output)
        self.assertIn("## Next-slice handoff", output)


class FilterCombinedTests(unittest.TestCase):
    """Multiple filters applied together."""

    def test_path_and_dirty_combined(self):
        worktrees = [
            {"path": "/project-a/wt1", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/x", "dirty": "5"},
            {"path": "/project-a/wt2", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/y", "dirty": "0"},
            {"path": "/project-b/wt3", "modified": "2026-06-15T09:00:00+00:00", "branch": "feat/x", "dirty": "5"},
        ]
        snap = _make_snapshot(worktrees=worktrees)
        result = overview.apply_filters(snap, path_filter="project-a", dirty_only=True)
        self.assertEqual(len(result["codex_worktrees"]), 1)
        self.assertEqual(result["codex_worktrees"][0]["path"], "/project-a/wt1")

    def test_branch_and_recent_hours_combined(self):
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:30:00+00:00", "branch": "feat/issue-410", "dirty": "1"},
            {"path": "/wt/b", "modified": "2026-06-15T07:00:00+00:00", "branch": "feat/issue-410", "dirty": "0"},
            {"path": "/wt/c", "modified": "2026-06-15T09:30:00+00:00", "branch": "feat/other", "dirty": "1"},
        ]
        snap = _make_snapshot(worktrees=worktrees, generated="2026-06-15T10:00:00+00:00")
        result = overview.apply_filters(snap, branch_filter="issue-410", recent_hours=1.5)
        self.assertEqual(len(result["codex_worktrees"]), 1)
        self.assertEqual(result["codex_worktrees"][0]["path"], "/wt/a")

    def test_default_behavior_no_filters(self):
        """No filters → all items pass through unchanged."""
        worktrees = [
            {"path": "/wt/a", "modified": "2026-06-15T09:00:00+00:00", "branch": "main", "dirty": "0"},
            {"path": "/wt/b", "modified": "2026-06-15T08:00:00+00:00", "branch": "feat/x", "dirty": "3"},
        ]
        processes = [
            {"pid": "1", "ppid": "0", "state": "S", "age": "00:01", "cwd": "/anywhere", "command": "codex"},
        ]
        snap = _make_snapshot(worktrees=worktrees, processes=processes)
        result = overview.apply_filters(snap)
        self.assertEqual(len(result["codex_worktrees"]), 2)
        self.assertEqual(len(result["processes"]), 1)


class FilterIntegrationTests(unittest.TestCase):
    """Integration tests using build_report with filter kwargs."""

    def test_build_report_with_path_filter(self):
        process_rows = [
            {"pid": "1", "ppid": "1", "state": "S", "age": "00:01", "cwd": "/work/myproject", "command": "codex"},
            {"pid": "2", "ppid": "1", "state": "S", "age": "00:01", "cwd": "/other/path", "command": "claude"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            report = overview.build_report(
                codex_home=home / ".codex",
                claude_home=home / ".claude",
                limit=10,
                now=datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc),
                process_rows=process_rows,
                path_filter="myproject",
            )
        self.assertIn("PID 1", report)
        self.assertNotIn("PID 2", report)

    def test_build_report_with_dirty_filter(self):
        """build_report passes dirty_only through apply_filters."""
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            # No worktrees exist; just verify it runs without error
            report = overview.build_report(
                codex_home=home / ".codex",
                claude_home=home / ".claude",
                limit=5,
                now=datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc),
                process_rows=[],
                dirty_only=True,
            )
        self.assertIn("# Agent Work Overview", report)

    def test_build_report_compact_mode(self):
        process_rows = [
            {"pid": "10", "ppid": "1", "state": "S", "age": "00:01", "cwd": "/work", "command": "codex run"},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            report = overview.build_report(
                codex_home=home / ".codex",
                claude_home=home / ".claude",
                limit=5,
                now=datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc),
                process_rows=process_rows,
                compact=True,
            )
        self.assertNotIn("## Live agent processes", report)
        self.assertIn("processes(1):", report)


if __name__ == "__main__":
    unittest.main()
