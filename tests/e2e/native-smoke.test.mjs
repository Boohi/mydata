import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const harness = path.join(repoRoot, "tests", "e2e", "native-smoke.mjs");

function runHarness(args, env = {}, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [harness, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    expectedStatus,
    `native smoke exited ${result.status}, expected ${expectedStatus}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );

  return result;
}

test("native smoke writes a synthetic report and skips Swift checks when requested", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mydata-native-smoke-"));
  const reportPath = path.join(tempRoot, "native-smoke.json");

  try {
    const result = runHarness(["--skip-swift", "--report", reportPath]);
    assert.match(result.stdout, /tauri-shell-config/);
    assert.match(result.stdout, /swift-ipc-contract/);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    assert.equal(report.status, "passed");
    assert.equal(report.syntheticOnly, true);
    assert.ok(report.generatedAt);

    const tauri = report.checks.find((check) => check.id === "tauri-shell-config");
    assert.equal(tauri.status, "passed");
    assert.equal(tauri.details.productName, "mydata");
    assert.equal(tauri.details.launchMode, "config-only");

    const swiftChecks = report.checks.filter((check) => check.id.startsWith("swift-"));
    assert.equal(swiftChecks.length, 3);
    for (const check of swiftChecks) {
      assert.equal(check.status, "skipped");
      assert.match(check.reason, /--skip-swift/);
    }

    assert.ok(report.skips.some((entry) => entry.id === "tauri-window-launch"));
    assert.doesNotMatch(JSON.stringify(report), /\.env|secret|token/i);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("native smoke fails clearly when Swift is required but unavailable", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mydata-native-smoke-required-"));
  const reportPath = path.join(tempRoot, "native-smoke.json");

  try {
    runHarness(["--require-swift", "--report", reportPath], { PATH: tempRoot }, 1);
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    assert.equal(report.status, "failed");
    assert.ok(
      report.checks.some(
        (check) => check.status === "failed" && /Swift is required/.test(check.reason)
      )
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
