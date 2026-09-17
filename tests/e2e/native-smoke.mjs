#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function parseArgs(argv) {
  const args = {
    report: path.join(repoRoot, "test-results", "e2e", "native-smoke.json"),
    requireSwift: false,
    skipSwift: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--report") {
      const next = argv[i + 1];
      if (!next) throw new Error("--report requires a path");
      args.report = next;
      i += 1;
      continue;
    }
    if (token === "--require-swift") {
      args.requireSwift = true;
      continue;
    }
    if (token === "--skip-swift") {
      args.skipSwift = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log(
    `Usage: node tests/e2e/native-smoke.mjs [options]\n\nOptions:\n  --report <path>    Write JSON report (default: test-results/e2e/native-smoke.json)\n  --require-swift    Fail when Swift is unavailable or Swift checks fail\n  --skip-swift       Skip Swift package checks with an explicit report reason\n  --help             Show this help`
  );
}

function commandExists(command) {
  const pathValue = process.env.PATH || "";
  const separator = os.platform() === "win32" ? ";" : ":";
  return pathValue.split(separator).some((dir) => {
    if (!dir) return false;
    const candidate = path.join(dir, command);
    return fs.existsSync(candidate);
  });
}

function loadTauriConfig() {
  const configPath = path.join(repoRoot, "apps", "ui", "src-tauri", "tauri.conf.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (config.productName !== "mydata") {
    throw new Error(`Unexpected Tauri productName: ${config.productName}`);
  }
  if (!Array.isArray(config.app?.windows) || config.app.windows.length === 0) {
    throw new Error("Tauri config must define at least one app window");
  }

  return {
    id: "tauri-shell-config",
    status: "passed",
    details: {
      productName: config.productName,
      identifier: config.identifier,
      windowCount: config.app.windows.length,
      launchMode: "config-only",
    },
  };
}

function runCommandCheck(id, command, args, options) {
  if (options.skipSwift) {
    return {
      id,
      status: "skipped",
      reason: "Swift checks skipped by --skip-swift; use --require-swift on macOS CI.",
    };
  }

  if (!commandExists(command)) {
    return {
      id,
      status: options.requireSwift ? "failed" : "skipped",
      reason: options.requireSwift
        ? "Swift is required for native e2e checks but was not found on PATH."
        : "Swift not found on PATH; native Swift checks are skipped on this host.",
    };
  }

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: "utf8",
  });

  return {
    id,
    status: result.status === 0 ? "passed" : "failed",
    command: [command, ...args].join(" "),
    exitCode: result.status,
    stdout: result.stdout.slice(-4000),
    stderr: result.stderr.slice(-4000),
    reason: result.status === 0 ? undefined : `${command} exited ${result.status}`,
  };
}

function buildReport(args) {
  const checks = [loadTauriConfig()];
  checks.push(
    runCommandCheck(
      "swift-ipc-contract",
      "swift",
      ["test", "--package-path", "packages/schema/Swift"],
      args
    ),
    runCommandCheck(
      "swift-daemon-synthetic-fixture",
      "swift",
      ["test", "--package-path", "apps/daemon"],
      args
    ),
    runCommandCheck(
      "swift-extension-contract",
      "swift",
      ["test", "--package-path", "apps/extension"],
      args
    )
  );

  const skips = checks
    .filter((check) => check.status === "skipped")
    .map((check) => ({ id: check.id, reason: check.reason }));

  skips.push({
    id: "tauri-window-launch",
    reason:
      "Skipped until issue #21 provides a signed Tauri shell/onboarding launch path suitable for CI.",
  });

  const failed = checks.filter((check) => check.status === "failed");

  return {
    status: failed.length > 0 ? "failed" : "passed",
    generatedAt: new Date().toISOString(),
    syntheticOnly: true,
    privacy: {
      realTraffic: false,
      realEnvFiles: false,
      sensitiveArtifacts: false,
    },
    checks,
    skips,
  };
}

function writeReport(reportPath, report) {
  const resolved = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(report, null, 2)}\n`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport(args);
  writeReport(args.report, report);

  for (const check of report.checks) {
    console.log(`${check.status.toUpperCase()} ${check.id}`);
    if (check.reason) console.log(`  ${check.reason}`);
  }
  console.log(`Report written: ${path.resolve(args.report)}`);

  process.exit(report.status === "passed" ? 0 : 1);
} catch (error) {
  const fallbackReport = {
    status: "failed",
    generatedAt: new Date().toISOString(),
    syntheticOnly: true,
    privacy: {
      realTraffic: false,
      realEnvFiles: false,
      sensitiveArtifacts: false,
    },
    checks: [
      {
        id: "native-smoke",
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      },
    ],
    skips: [],
  };
  const reportArgIndex = process.argv.indexOf("--report");
  if (reportArgIndex >= 0 && process.argv[reportArgIndex + 1]) {
    writeReport(process.argv[reportArgIndex + 1], fallbackReport);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
