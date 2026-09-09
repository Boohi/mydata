import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const MAX_NEW_GOAL_OBJECTIVE_CHARACTERS = 2_000;
export const MAX_PERSISTED_GOAL_OBJECTIVE_CHARACTERS = 2_025;
export const LEGACY_ASSOCIATION_REJECTED_ERROR = Object.freeze({
  code: "ASSOCIATION_REJECTED",
  summary:
    "The created runtime objective is 2025 characters, exceeding the progress artifact objective limit of 2000; exact association cannot be persisted.",
});

const MAX_INPUT_BYTES = 16_384;
const STATE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATE_ID_OCCURRENCE =
  /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const SECRET =
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{16,}|\b(?:sk[-_]|ghp_|github_pat_)[A-Za-z0-9_-]{16,}|\b(?:api[_-]?key|token|secret|password)\s*[=:]\s*[^\s]{16,})/i;
const COMMANDS = new Set([
  "bind-short-approval",
  "validate-new",
  "validate-recovery",
]);
const SHORT_APPROVALS = new Set(["yes", "i approve", "approved"]);
const APPROVAL_SNAPSHOT_HEADER = "Superify activation approval snapshot:";
const APPROVAL_SNAPSHOT_FOOTER_PREFIX =
  "Approve this exact snapshot? I recommend approving this exact snapshot for ";
const APPROVAL_SNAPSHOT_FOOTER_SUFFIX = " as the best bounded choice.";
const APPROVAL_SNAPSHOT_ROW =
  /^- State ID ([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}); package revision ([1-9][0-9]*); plan revision ([1-9][0-9]*)\.$/iu;
const CLI_HELP = `Usage:
  superify-activation.mjs bind-short-approval --input -
  superify-activation.mjs validate-new --input <file|->
  superify-activation.mjs validate-recovery --input <file|->
`;

export class SuperifyActivationError extends Error {
  constructor(code) {
    super("Superify activation preflight failed.");
    this.name = "SuperifyActivationError";
    this.code = code;
  }
}

function fail(code) {
  throw new SuperifyActivationError(code);
}

function exactObject(value, keys, code = "INVALID_INPUT") {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  const actual = Object.keys(value);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key)) ||
    keys.some((key) => !(key in value))
  ) {
    fail(code);
  }
}

function positiveInteger(value, code = "INVALID_INPUT") {
  if (!Number.isSafeInteger(value) || value < 1) fail(code);
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeText(
  value,
  { max, min = 0, code = "INVALID_INPUT", tooLongCode = code },
) {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    SECRET.test(decodeURIComponentSafe(value))
  ) {
    fail(value?.length > max ? tooLongCode : code);
  }
}

function stateIdentity(value) {
  if (typeof value !== "string" || !STATE_ID.test(value)) {
    fail("INVALID_STATE_ID");
  }
}

function digest(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function validatedObjective({ stateId, objective, max, requireOverNewLimit }) {
  stateIdentity(stateId);
  safeText(objective, {
    max,
    min: 1,
    code: "INVALID_OBJECTIVE",
    tooLongCode: "OBJECTIVE_TOO_LONG",
  });
  if (!objective.includes(stateId)) fail("OBJECTIVE_STATE_ID_MISSING");
  if (requireOverNewLimit && objective.length <= MAX_NEW_GOAL_OBJECTIVE_CHARACTERS) {
    fail("RECOVERY_NOT_LEGACY_OVER_LIMIT");
  }
  return {
    objective,
    length: objective.length,
    sha256: digest(objective),
  };
}

export function validateNewGoalObjective(input) {
  exactObject(input, ["stateId", "objective"]);
  return validatedObjective({
    ...input,
    max: MAX_NEW_GOAL_OBJECTIVE_CHARACTERS,
    requireOverNewLimit: false,
  });
}

export function validateLegacyRecoveryObjective(input) {
  exactObject(input, [
    "stateId",
    "objective",
    "goalStatus",
    "sameState",
    "permissionConsumed",
    "associationPresent",
    "createOutcome",
  ]);
  if (input.goalStatus !== "active") fail("RECOVERY_GOAL_NOT_ACTIVE");
  if (input.sameState !== true) fail("RECOVERY_NOT_SAME_STATE");
  if (input.permissionConsumed !== true) fail("RECOVERY_PERMISSION_MISSING");
  if (input.associationPresent !== false) fail("RECOVERY_ALREADY_ASSOCIATED");
  if (input.createOutcome !== "documented_success") {
    fail("RECOVERY_CREATE_UNCONFIRMED");
  }
  const validated = validatedObjective({
    stateId: input.stateId,
    objective: input.objective,
    max: MAX_PERSISTED_GOAL_OBJECTIVE_CHARACTERS,
    requireOverNewLimit: true,
  });
  if (validated.length !== MAX_PERSISTED_GOAL_OBJECTIVE_CHARACTERS) {
    fail("RECOVERY_LENGTH_MISMATCH");
  }
  return {
    action: "associate_existing",
    createGoal: false,
    recoveryError: { ...LEGACY_ASSOCIATION_REJECTED_ERROR },
    ...validated,
  };
}

function normalizeShortApproval(value) {
  safeText(value, { max: 80, min: 1, code: "APPROVAL_NOT_EXACT" });
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[.!]+$/u, "")
    .trim();
}

function canonicalApprovalStates(states, code) {
  if (!Array.isArray(states) || states.length < 1 || states.length > 50) {
    fail(code);
  }
  const seen = new Set();
  const canonical = states.map((state) => {
    exactObject(
      state,
      ["stateId", "packageRevision", "planRevision"],
      code,
    );
    stateIdentity(state.stateId);
    positiveInteger(state.packageRevision, code);
    positiveInteger(state.planRevision, code);
    const stateId = state.stateId.toLocaleLowerCase("en-US");
    if (seen.has(stateId)) fail(code);
    seen.add(stateId);
    return {
      stateId,
      packageRevision: state.packageRevision,
      planRevision: state.planRevision,
    };
  });
  return canonical.sort((left, right) => left.stateId.localeCompare(right.stateId));
}

function canonicalCurrentStates(states, code) {
  if (!Array.isArray(states) || states.length < 1 || states.length > 50) {
    fail(code);
  }
  const seen = new Set();
  const canonical = states.map((state) => {
    exactObject(
      state,
      ["stateId", "revision", "packageRevision", "planRevision"],
      code,
    );
    stateIdentity(state.stateId);
    positiveInteger(state.revision, code);
    positiveInteger(state.packageRevision, code);
    positiveInteger(state.planRevision, code);
    const stateId = state.stateId.toLocaleLowerCase("en-US");
    if (seen.has(stateId)) fail(code);
    seen.add(stateId);
    return {
      stateId,
      revision: state.revision,
      packageRevision: state.packageRevision,
      planRevision: state.planRevision,
    };
  });
  return canonical.sort((left, right) => left.stateId.localeCompare(right.stateId));
}

function approvedState(binding) {
  const { stateId, packageRevision, planRevision } = binding;
  return { stateId, packageRevision, planRevision };
}

function validApprovalReason(reason, code) {
  safeText(reason, { max: 160, min: 1, code });
  if (
    reason !== reason.trim() ||
    /[\r\n\u2028\u2029]/u.test(reason) ||
    STATE_ID_OCCURRENCE.test(reason) ||
    /\b(?:package|plan) revision\b/iu.test(reason)
  ) {
    fail(code);
  }
  return reason;
}

export function formatApprovalSnapshot(input) {
  exactObject(input, ["states", "reason"], "INVALID_APPROVAL_SNAPSHOT");
  const states = canonicalApprovalStates(
    input.states,
    "INVALID_APPROVAL_SNAPSHOT",
  );
  const reason = validApprovalReason(
    input.reason,
    "INVALID_APPROVAL_SNAPSHOT",
  );
  return [
    APPROVAL_SNAPSHOT_HEADER,
    ...states.map(
      (state) =>
        `- State ID ${state.stateId}; package revision ${state.packageRevision}; plan revision ${state.planRevision}.`,
    ),
    `${APPROVAL_SNAPSHOT_FOOTER_PREFIX}${reason}${APPROVAL_SNAPSHOT_FOOTER_SUFFIX}`,
  ].join("\n");
}

export function parseApprovalSnapshot(message) {
  safeText(message, {
    max: 12_000,
    min: 1,
    code: "APPROVAL_SNAPSHOT_NOT_EXACT",
  });
  const lines = message.split("\n");
  if (
    lines.length < 3 ||
    lines.length > 52 ||
    lines[0] !== APPROVAL_SNAPSHOT_HEADER
  ) {
    fail("APPROVAL_SNAPSHOT_NOT_EXACT");
  }
  const footer = lines.at(-1);
  if (
    !footer.startsWith(APPROVAL_SNAPSHOT_FOOTER_PREFIX) ||
    !footer.endsWith(APPROVAL_SNAPSHOT_FOOTER_SUFFIX)
  ) {
    fail("APPROVAL_SNAPSHOT_NOT_EXACT");
  }
  const reason = footer.slice(
    APPROVAL_SNAPSHOT_FOOTER_PREFIX.length,
    -APPROVAL_SNAPSHOT_FOOTER_SUFFIX.length,
  );
  validApprovalReason(reason, "APPROVAL_SNAPSHOT_NOT_EXACT");

  const seen = new Set();
  const states = lines.slice(1, -1).map((line) => {
    const match = line.match(APPROVAL_SNAPSHOT_ROW);
    if (!match) fail("APPROVAL_SNAPSHOT_NOT_EXACT");
    const stateId = match[1].toLocaleLowerCase("en-US");
    if (seen.has(stateId)) fail("APPROVAL_SNAPSHOT_NOT_EXACT");
    seen.add(stateId);
    const packageRevision = Number(match[2]);
    const planRevision = Number(match[3]);
    positiveInteger(packageRevision, "APPROVAL_SNAPSHOT_NOT_EXACT");
    positiveInteger(planRevision, "APPROVAL_SNAPSHOT_NOT_EXACT");
    return { stateId, packageRevision, planRevision };
  });
  const canonical = [...states].sort((left, right) =>
    left.stateId.localeCompare(right.stateId),
  );
  if (JSON.stringify(states) !== JSON.stringify(canonical)) {
    fail("APPROVAL_SNAPSHOT_NOT_EXACT");
  }
  return { states, reason };
}

export function bindShortApproval(input) {
  exactObject(input, ["reply", "message", "snapshot", "currentStates"]);
  exactObject(input.snapshot, ["states"]);
  const canonicalStates = canonicalApprovalStates(
    input.snapshot.states,
    "INVALID_APPROVAL_SNAPSHOT",
  );
  const currentStates = canonicalCurrentStates(
    input.currentStates,
    "INVALID_CURRENT_STATES",
  );
  const { states: displayedStates } = parseApprovalSnapshot(input.message);
  const expectedDisplay = canonicalStates;
  if (JSON.stringify(displayedStates) !== JSON.stringify(expectedDisplay)) {
    fail("APPROVAL_SNAPSHOT_MISMATCH");
  }
  if (
    JSON.stringify(currentStates.map(approvedState)) !==
    JSON.stringify(canonicalStates)
  ) {
    fail("BATCH_PREFLIGHT_DRIFT");
  }
  if (!SHORT_APPROVALS.has(normalizeShortApproval(input.reply))) {
    fail("APPROVAL_NOT_EXACT");
  }
  return {
    approved: true,
    stateCount: canonicalStates.length,
    snapshotSha256: digest(JSON.stringify(expectedDisplay)),
    preflightSha256: digest(JSON.stringify(currentStates)),
  };
}

function parseArgs(argv) {
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
    return { help: true };
  }
  if (
    argv.length !== 3 ||
    !COMMANDS.has(argv[0]) ||
    argv[1] !== "--input" ||
    !argv[2]
  ) {
    fail("INVALID_ARGUMENTS");
  }
  return { command: argv[0], input: argv[2] };
}

function readCappedFd(fd, maximum, readSync) {
  const buffer = Buffer.alloc(maximum + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const requested = buffer.length - offset;
    const bytesRead = readSync(fd, buffer, offset, requested, null);
    if (
      !Number.isSafeInteger(bytesRead) ||
      bytesRead < 0 ||
      bytesRead > requested
    ) {
      fail("INPUT_READ_FAILED");
    }
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset > maximum) fail("INPUT_TOO_LARGE");
  return buffer.subarray(0, offset);
}

async function readCappedHandle(handle, maximum) {
  const buffer = Buffer.alloc(maximum + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const requested = buffer.length - offset;
    const result = await handle.read(buffer, offset, requested, offset);
    const bytesRead = result?.bytesRead;
    if (
      !Number.isSafeInteger(bytesRead) ||
      bytesRead < 0 ||
      bytesRead > requested
    ) {
      fail("INPUT_READ_FAILED");
    }
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset > maximum) fail("INPUT_TOO_LARGE");
  return buffer.subarray(0, offset);
}

async function readInput(selector, deps = {}) {
  let bytes;
  try {
    if (selector === "-") {
      bytes = readCappedFd(0, MAX_INPUT_BYTES, deps.readSync ?? fs.readSync);
    } else {
      const fsOps = deps.fsOps ?? fs.promises;
      const handle = await fsOps.open(selector, fs.constants.O_RDONLY);
      try {
        bytes = await readCappedHandle(handle, MAX_INPUT_BYTES);
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    if (error instanceof SuperifyActivationError) throw error;
    fail("INPUT_READ_FAILED");
  }
  let input;
  try {
    input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("INVALID_JSON");
  }
  return input;
}

export async function runCli(argv, deps = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) return { output: CLI_HELP };
  if (parsed.command === "bind-short-approval" && parsed.input !== "-") {
    fail("APPROVAL_INPUT_STDIN_REQUIRED");
  }
  const input = await readInput(parsed.input, deps);
  if (parsed.command === "validate-new") {
    const { length, sha256 } = validateNewGoalObjective(input);
    return { envelope: { ok: true, length, sha256 } };
  }
  if (parsed.command === "validate-recovery") {
    const { action, createGoal, recoveryError, length, sha256 } =
      validateLegacyRecoveryObjective(input);
    return {
      envelope: {
        ok: true,
        action,
        createGoal,
        recoveryError,
        length,
        sha256,
      },
    };
  }
  return { envelope: { ok: true, ...bindShortApproval(input) } };
}

export async function main(argv = process.argv.slice(2), io = {}, deps = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  try {
    const result = await runCli(argv, deps);
    stdout.write(result.output ?? `${JSON.stringify(result.envelope)}\n`);
    return 0;
  } catch (error) {
    const code =
      error instanceof SuperifyActivationError && /^[A-Z0-9_]+$/.test(error.code)
        ? error.code
        : "OPERATION_FAILED";
    stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
    return 1;
  }
}

async function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    const [invoked, modulePath] = await Promise.all([
      fs.promises.realpath(process.argv[1]),
      fs.promises.realpath(fileURLToPath(import.meta.url)),
    ]);
    return invoked === modulePath;
  } catch {
    return false;
  }
}

if (await isDirectRun()) process.exitCode = await main();
