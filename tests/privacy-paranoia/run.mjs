#!/usr/bin/env node
// Privacy paranoia harness.
// Launches each registered binary (and the fixture talker) inside a
// network-isolated sandbox. Fails loudly if any registered binary
// completes a connection, and asserts the fixture talker DOES fail
// (proving the sandbox actually blocks outbound traffic).
//
// Linux CI: uses `unshare -rn` to create a private network namespace.
// macOS / Windows dev: harness is informational only — see README.
import { readFile } from "node:fs/promises";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

export async function loadRegistry() {
  const raw = await readFile(resolve(__dirname, "binaries.json"), "utf8");
  const parsed = JSON.parse(raw);
  validateRegistry(parsed);
  return parsed;
}

export function validateRegistry(reg) {
  if (reg.version !== 1) {
    throw new Error(`unsupported registry version: ${reg.version}`);
  }
  if (!Array.isArray(reg.binaries)) {
    throw new Error("binaries must be an array");
  }
  for (const [i, b] of reg.binaries.entries()) {
    if (typeof b.path !== "string") {
      throw new Error(`binaries[${i}].path must be a string`);
    }
    if (b.args !== undefined && !Array.isArray(b.args)) {
      throw new Error(`binaries[${i}].args must be an array`);
    }
  }
}

export function isSandboxAvailable() {
  if (process.platform !== "linux") return false;
  const r = spawnSync("unshare", ["--help"], { stdio: "ignore" });
  return r.status === 0;
}

function runInSandbox(command, args, timeoutMs = 5000) {
  const wrapped = isSandboxAvailable()
    ? { cmd: "unshare", args: ["-rn", command, ...args] }
    : { cmd: command, args };
  return new Promise((resolveFn) => {
    const child = spawn(wrapped.cmd, wrapped.args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolveFn({ code, signal, stdout, stderr });
    });
  });
}

async function verifySandboxBlocksOutbound() {
  const talker = resolve(__dirname, "fixtures", "talker.mjs");
  const r = await runInSandbox("node", [talker]);
  if (r.code === 0 && /CONNECTED/.test(r.stdout)) {
    throw new Error(
      "Sandbox FAILED to block outbound traffic — fixture talker connected. " +
        "The privacy paranoia test cannot trust its results."
    );
  }
  return r;
}

async function checkBinary(bin) {
  const abs = resolve(REPO_ROOT, bin.path);
  const r = await runInSandbox(abs, bin.args ?? []);
  if (/CONNECTED/.test(r.stdout) || /CONNECTED/.test(r.stderr)) {
    throw new Error(`Binary ${bin.path} reported a successful outbound connection`);
  }
  return r;
}

export async function main() {
  const reg = await loadRegistry();
  const onLinux = process.platform === "linux";

  if (!onLinux) {
    console.log("privacy-paranoia: not on Linux, harness runs in advisory mode only.");
    console.log(`privacy-paranoia: registry has ${reg.binaries.length} binaries.`);
    return 0;
  }

  if (!isSandboxAvailable()) {
    console.error("privacy-paranoia: unshare not available; cannot enforce. FAIL.");
    return 1;
  }

  console.log("privacy-paranoia: verifying sandbox blocks outbound...");
  await verifySandboxBlocksOutbound();
  console.log("privacy-paranoia: sandbox verified.");

  if (reg.binaries.length === 0) {
    console.log("privacy-paranoia: no binaries registered yet. PASS (trivially).");
    return 0;
  }

  for (const bin of reg.binaries) {
    console.log(`privacy-paranoia: checking ${bin.path}...`);
    await checkBinary(bin);
    console.log(`privacy-paranoia: ${bin.path} did not phone home. OK.`);
  }
  console.log("privacy-paranoia: all checks passed.");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("privacy-paranoia: FAIL");
      console.error(err.message);
      process.exit(1);
    });
}
