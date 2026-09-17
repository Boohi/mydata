import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID as systemRandomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  LEGACY_ASSOCIATION_REJECTED_ERROR,
  MAX_NEW_GOAL_OBJECTIVE_CHARACTERS,
  MAX_PERSISTED_GOAL_OBJECTIVE_CHARACTERS,
} from "./superify-activation.mjs";

export const SCHEMA_VERSION = "superify.progress.v1";
export const STALE_AFTER_MS = 900_000;
export const MAX_DOCUMENT_BYTES = 524_288;
export const LOCK_RECOVERY_AGE_MS = 300_000;
export const LOCAL_ID = /^[a-z][a-z0-9-]{0,63}$/;
export const STATE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class SuperifyStateError extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.name = "SuperifyStateError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

const secret =
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{16,}|\b(?:sk[-_]|ghp_|github_pat_)[A-Za-z0-9_-]{16,}|\b(?:api[_-]?key|token|secret|password)\s*[=:]\s*[^\s]{16,})/i;
const pkgKeys = [
  "outcome",
  "userValue",
  "intendedArtifact",
  "startingState",
  "firstSlice",
  "confirmedRequirements",
  "preferences",
  "assumptions",
  "constraints",
  "resourceEnvelope",
  "nonGoals",
  "laterHorizons",
  "milestoneIds",
  "researchTasks",
  "risks",
  "approvalBoundaries",
  "verificationSurfaces",
  "iterationPolicy",
  "blockedStopCondition",
  "definitionOfDone",
];
const pkgArrays = new Set([
  "confirmedRequirements",
  "preferences",
  "assumptions",
  "constraints",
  "resourceEnvelope",
  "nonGoals",
  "laterHorizons",
  "milestoneIds",
  "researchTasks",
  "risks",
  "approvalBoundaries",
  "verificationSurfaces",
  "definitionOfDone",
]);
const topKeys = [
  "schemaVersion",
  "revision",
  "packageRevision",
  "planRevision",
  "createdAt",
  "updatedAt",
  "package",
  "goal",
  "activation",
  "milestones",
  "steps",
  "blockers",
  "decisions",
  "blockedAudit",
  "activity",
  "telemetry",
  "links",
  "state",
  "error",
  "staleAfterMs",
  "planProjection",
  "verification",
];

const fail = (code = "INVALID_DOCUMENT") => {
  throw new SuperifyStateError(code, "Superify state is invalid.");
};
function obj(v, keys) {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail();
  const own = Object.keys(v);
  if (own.some((k) => !keys.includes(k)) || keys.some((k) => !(k in v))) fail();
  return v;
}
function text(v, max = 160, nullable = false) {
  if (nullable && v === null) return;
  if (
    typeof v !== "string" ||
    v.length > max ||
    secret.test(decodeURIComponentSafe(v))
  )
    fail();
}
function enumv(v, vals) {
  if (!vals.includes(v)) fail();
}
function integer(v, min = 0) {
  if (!Number.isInteger(v) || v < min) fail();
}
function timestamp(v, nullable = false) {
  if (nullable && v === null) return;
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)
  )
    fail();
  try {
    if (new Date(v).toISOString() !== v) fail();
  } catch {
    fail();
  }
}
function id(v) {
  if (typeof v !== "string" || !LOCAL_ID.test(v)) fail();
}
function array(v, max) {
  if (!Array.isArray(v) || v.length > max) fail();
}
function unique(values) {
  if (new Set(values).size !== values.length) fail();
}
function decodeURIComponentSafe(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
function errorValue(v) {
  if (v === null) return;
  obj(v, ["code", "summary"]);
  text(v.code);
  text(v.summary, 500);
}
function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    fail();
  }
}

export function validateProgressDocument(input) {
  let encodedBytes;
  try {
    encodedBytes = new TextEncoder().encode(JSON.stringify(input)).byteLength;
  } catch {
    fail();
  }
  // Persisted artifacts always include one trailing newline.
  if (encodedBytes + 1 > MAX_DOCUMENT_BYTES) fail("DOCUMENT_TOO_LARGE");
  const d = safeClone(input);
  obj(d, topKeys);
  if (d.schemaVersion !== SCHEMA_VERSION) fail("UNSUPPORTED_SCHEMA");
  for (const k of ["revision", "packageRevision", "planRevision"])
    integer(d[k], 1);
  timestamp(d.createdAt);
  timestamp(d.updatedAt);
  if (Date.parse(d.updatedAt) < Date.parse(d.createdAt)) fail();
  integer(d.staleAfterMs, 1);
  obj(d.package, pkgKeys);
  for (const k of pkgKeys) {
    const v = d.package[k];
    if (pkgArrays.has(k)) {
      array(v, 50);
      unique(v);
      for (const s of v) {
        if (k === "milestoneIds") id(s);
        else text(s, 500);
      }
    } else text(v, 160);
  }
  if (d.goal !== null) {
    obj(d.goal, ["status", "title", "objective", "id", "source"]);
    enumv(d.goal.status, ["active", "complete", "blocked"]);
    text(d.goal.title);
    text(d.goal.objective, MAX_PERSISTED_GOAL_OBJECTIVE_CHARACTERS);
    id(d.goal.id);
    enumv(d.goal.source, ["superify.skill"]);
  }
  obj(d.activation, [
    "stateId",
    "status",
    "attempt",
    "approvedPackageRevision",
    "approvedPlanRevision",
    "approvedAt",
    "permissionConsumedAt",
    "associatedGoal",
    "lastError",
    "runtime",
  ]);
  if (!STATE_ID.test(d.activation.stateId)) fail();
  enumv(d.activation.status, [
    "awaiting_approval",
    "approved",
    "not_started",
    "active",
    "conflict",
    "unsupported",
  ]);
  integer(d.activation.attempt);
  enumv(d.activation.runtime, ["codex"]);
  for (const k of ["approvedPackageRevision", "approvedPlanRevision"])
    if (d.activation[k] !== null) integer(d.activation[k], 1);
  timestamp(d.activation.approvedAt, true);
  timestamp(d.activation.permissionConsumedAt, true);
  text(d.activation.runtime);
  errorValue(d.activation.lastError);
  if (d.activation.status === "active" && d.activation.lastError !== null)
    fail();
  const approvals = [
    d.activation.approvedPackageRevision,
    d.activation.approvedPlanRevision,
    d.activation.approvedAt,
    d.activation.permissionConsumedAt,
  ];
  if (
    d.activation.permissionConsumedAt !== null &&
    (d.activation.attempt < 1 || approvals.slice(0, 3).some((x) => x === null))
  )
    fail();
  if (
    d.activation.permissionConsumedAt !== null &&
    Date.parse(d.activation.permissionConsumedAt) <
      Date.parse(d.activation.approvedAt)
  )
    fail();
  if (d.activation.attempt === 0 && approvals.some((x) => x !== null)) fail();
  if (
    d.activation.status !== "active" &&
    d.activation.approvedPackageRevision !== null &&
    d.activation.approvedPackageRevision !== d.packageRevision
  )
    fail();
  if (
    d.activation.status !== "active" &&
    d.activation.approvedPlanRevision !== null &&
    d.activation.approvedPlanRevision !== d.planRevision
  )
    fail();
  if (d.activation.associatedGoal !== null) {
    obj(d.activation.associatedGoal, ["externalId", "confirmedAt"]);
    text(d.activation.associatedGoal.externalId, 160, true);
    timestamp(d.activation.associatedGoal.confirmedAt);
    if (
      d.activation.permissionConsumedAt === null ||
      Date.parse(d.activation.associatedGoal.confirmedAt) <
        Date.parse(d.activation.permissionConsumedAt) ||
      d.activation.status !== "active" ||
      !["active", "complete", "blocked"].includes(d.goal?.status)
    )
      fail();
  }
  if (d.activation.status === "active") {
    if (
      d.activation.attempt < 1 ||
      d.activation.approvedPackageRevision === null ||
      d.activation.approvedPlanRevision === null ||
      d.activation.approvedAt === null ||
      d.activation.permissionConsumedAt === null ||
      d.activation.associatedGoal === null ||
      !["active", "complete", "blocked"].includes(d.goal?.status)
    )
      fail();
  }
  if (
    d.goal !== null &&
    (d.activation.status !== "active" || d.activation.associatedGoal === null)
  )
    fail();
  if (
    d.goal !== null &&
    d.goal.objective.length > MAX_NEW_GOAL_OBJECTIVE_CHARACTERS &&
    (d.goal.objective.length !== MAX_PERSISTED_GOAL_OBJECTIVE_CHARACTERS ||
      !d.goal.objective.includes(d.activation.stateId) ||
      d.activation.status !== "active" ||
      d.activation.permissionConsumedAt === null ||
      d.activation.associatedGoal === null)
  )
    fail("INVALID_LEGACY_OBJECTIVE");

  array(d.milestones, 20);
  array(d.steps, 200);
  array(d.blockers, 200);
  array(d.decisions, 200);
  array(d.verification, 200);
  array(d.activity, 100);
  array(d.links, 50);
  unique(d.milestones.map((x) => x.id));
  unique(d.steps.map((x) => x.id));
  unique(d.blockers.map((x) => x.id));
  unique(d.decisions.map((x) => x.id));
  unique(d.verification.map((x) => x.id));
  unique(d.activity.map((x) => x.seq));
  unique(d.links.map((x) => x.id));
  const mids = new Set(d.milestones.map((x) => x.id)),
    sids = new Set(d.steps.map((x) => x.id)),
    bids = new Set(d.blockers.map((x) => x.id)),
    dids = new Set(d.decisions.map((x) => x.id)),
    vids = new Set(d.verification.map((x) => x.id));
  if (JSON.stringify(d.package.milestoneIds) !== JSON.stringify([...mids]))
    fail();
  for (const m of d.milestones) {
    obj(m, ["id", "title", "status", "stepIds"]);
    id(m.id);
    text(m.title);
    enumv(m.status, ["pending", "in_progress", "blocked", "completed"]);
    array(m.stepIds, 200);
    unique(m.stepIds);
    if (
      m.stepIds.some((x) => !sids.has(x)) ||
      JSON.stringify(m.stepIds) !==
        JSON.stringify(
          d.steps.filter((s) => s.milestoneId === m.id).map((s) => s.id),
        )
    )
      fail();
  }
  let active = 0;
  for (const s of d.steps) {
    obj(s, [
      "id",
      "milestoneId",
      "title",
      "status",
      "source",
      "verificationIds",
      "blockerIds",
      "updatedAt",
    ]);
    id(s.id);
    id(s.milestoneId);
    if (!mids.has(s.milestoneId)) fail();
    text(s.title);
    text(s.source, 500);
    enumv(s.status, ["pending", "in_progress", "blocked", "completed"]);
    active += s.status === "in_progress";
    timestamp(s.updatedAt);
    array(s.verificationIds, 200);
    array(s.blockerIds, 200);
    unique(s.verificationIds);
    unique(s.blockerIds);
    if (
      s.verificationIds.some((x) => !vids.has(x)) ||
      s.blockerIds.some((x) => !bids.has(x)) ||
      !s.verificationIds.some(
        (x) => d.verification.find((v) => v.id === x)?.required,
      )
    )
      fail();
    const reciprocalVerificationIds = d.verification
      .filter((verification) => verification.stepIds.includes(s.id))
      .map((verification) => verification.id);
    if (
      JSON.stringify(s.verificationIds) !==
      JSON.stringify(reciprocalVerificationIds)
    )
      fail();
    const directBlockerIds = d.blockers
      .filter((blocker) => blocker.stepId === s.id)
      .map((blocker) => blocker.id);
    if (JSON.stringify(s.blockerIds) !== JSON.stringify(directBlockerIds))
      fail();
  }
  if (active > 1) fail();
  for (const b of d.blockers) {
    obj(b, [
      "id",
      "label",
      "status",
      "severity",
      "milestoneId",
      "stepId",
      "openedAt",
      "resolvedAt",
      "source",
    ]);
    id(b.id);
    text(b.label);
    enumv(b.status, ["open", "resolved"]);
    enumv(b.severity, ["watch", "blocking"]);
    if ((b.milestoneId === null) === (b.stepId === null)) fail();
    if (b.milestoneId !== null && !mids.has(b.milestoneId)) fail();
    if (b.stepId !== null && !sids.has(b.stepId)) fail();
    timestamp(b.openedAt);
    timestamp(b.resolvedAt, true);
    text(b.source);
    if ((b.status === "resolved") !== (b.resolvedAt !== null)) fail();
    if (
      b.resolvedAt !== null &&
      Date.parse(b.resolvedAt) < Date.parse(b.openedAt)
    )
      fail();
  }
  for (const x of d.decisions) {
    obj(x, ["id", "label", "status", "approvalRequired", "resolvedAt"]);
    id(x.id);
    text(x.label);
    enumv(x.status, ["open", "resolved"]);
    if (typeof x.approvalRequired !== "boolean") fail();
    timestamp(x.resolvedAt, true);
    if ((x.status === "resolved") !== (x.resolvedAt !== null)) fail();
  }
  for (const v of d.verification) {
    obj(v, [
      "id",
      "label",
      "status",
      "required",
      "stepIds",
      "summary",
      "observedAt",
      "evidenceRefs",
      "skipReason",
      "approvalDecisionId",
    ]);
    id(v.id);
    text(v.label);
    enumv(v.status, ["planned", "passed", "failed", "skipped"]);
    if (typeof v.required !== "boolean") fail();
    array(v.stepIds, 200);
    if (v.stepIds.some((x) => !sids.has(x))) fail();
    text(v.summary, 500, true);
    timestamp(v.observedAt, true);
    array(v.evidenceRefs, 50);
    for (const x of v.evidenceRefs) text(x, 500);
    text(v.skipReason, 500, true);
    if (v.approvalDecisionId !== null && !dids.has(v.approvalDecisionId))
      fail();
    if (v.status === "skipped") {
      const decision = d.decisions.find((x) => x.id === v.approvalDecisionId);
      if (
        !v.skipReason ||
        !decision ||
        decision.status !== "resolved" ||
        !decision.approvalRequired
      )
        fail();
      if (Date.parse(v.observedAt) < Date.parse(decision.resolvedAt)) fail();
    }
    if (v.status === "planned" && v.observedAt !== null) fail();
    if (v.status !== "planned" && v.observedAt === null) fail();
    if (
      v.observedAt !== null &&
      Date.parse(v.observedAt) < Date.parse(d.createdAt)
    )
      fail();
    for (const stepId of v.stepIds) {
      const step = d.steps.find((candidate) => candidate.id === stepId);
      if (!step.verificationIds.includes(v.id)) fail();
    }
  }
  for (const s of d.steps.filter((x) => x.status === "completed"))
    for (const x of s.verificationIds
      .map((x) => d.verification.find((v) => v.id === x))
      .filter((v) => v.required))
      if (!["passed", "skipped"].includes(x.status)) fail();
  obj(d.blockedAudit, [
    "conditionId",
    "lastObservedGoalTurnId",
    "resumedAt",
    "resetReason",
    "consecutiveGoalTurns",
  ]);
  integer(d.blockedAudit.consecutiveGoalTurns);
  timestamp(d.blockedAudit.resumedAt, true);
  text(d.blockedAudit.resetReason, 500, true);
  if (
    d.blockedAudit.lastObservedGoalTurnId !== null &&
    !STATE_ID.test(d.blockedAudit.lastObservedGoalTurnId)
  )
    fail();
  if (d.blockedAudit.conditionId !== null) {
    const b = d.blockers.find((x) => x.id === d.blockedAudit.conditionId);
    if (!b || b.status !== "open" || b.severity !== "blocking") fail();
    if (
      d.blockedAudit.consecutiveGoalTurns < 1 ||
      d.blockedAudit.lastObservedGoalTurnId === null
    )
      fail();
  } else if (d.blockedAudit.consecutiveGoalTurns !== 0) {
    fail();
  }
  for (const a of d.activity) {
    obj(a, ["seq", "at", "type", "label", "actor", "stepId"]);
    integer(a.seq, 1);
    timestamp(a.at);
    enumv(a.type, [
      "goal_activated",
      "milestone_completed",
      "verification_passed",
      "step_started",
      "package_approved",
      "activation_permission_consumed",
      "step_completed",
      "blocker_opened",
      "blocker_resolved",
      "decision_resolved",
      "projection_updated",
      "telemetry_updated",
    ]);
    text(a.label);
    enumv(a.actor, ["orchestrator"]);
    if (a.stepId !== null && !sids.has(a.stepId)) fail();
  }
  obj(d.telemetry, ["tokens", "elapsedMs"]);
  telemetry(d.telemetry.tokens, "tokens");
  telemetry(d.telemetry.elapsedMs, "elapsedMs");
  for (const l of d.links) {
    obj(l, ["id", "label", "href", "kind"]);
    id(l.id);
    text(l.label);
    text(l.href, 500);
    enumv(l.kind, ["issue", "pull_request", "artifact", "evidence", "viewer"]);
    let u;
    try {
      u = new URL(l.href);
    } catch {
      fail();
    }
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.username !== "" ||
      u.password !== ""
    )
      fail();
  }
  enumv(d.state, [
    "draft",
    "ready",
    "blocked",
    "complete",
    "conflict",
    "unsupported",
    "error",
  ]);
  errorValue(d.error);
  if ((d.state === "error") !== (d.error !== null)) fail();
  obj(d.planProjection, [
    "status",
    "lastProjectedPlanRevision",
    "observedAt",
    "lastError",
    "client",
  ]);
  enumv(d.planProjection.status, ["not_projected", "stale", "synced", "error"]);
  if (d.planProjection.lastProjectedPlanRevision !== null)
    integer(d.planProjection.lastProjectedPlanRevision, 1);
  timestamp(d.planProjection.observedAt, true);
  errorValue(d.planProjection.lastError);
  enumv(d.planProjection.client, ["codex"]);
  if (d.planProjection.status === "not_projected") {
    if (
      d.planProjection.lastProjectedPlanRevision !== null ||
      d.planProjection.observedAt !== null ||
      d.planProjection.lastError !== null
    )
      fail();
  } else if (d.planProjection.status === "synced") {
    if (
      d.planProjection.lastProjectedPlanRevision !== d.planRevision ||
      d.planProjection.observedAt === null ||
      d.planProjection.lastError !== null
    )
      fail();
  } else if (d.planProjection.status === "error") {
    if (
      d.planProjection.observedAt === null ||
      d.planProjection.lastError === null
    )
      fail();
  } else if (d.planProjection.lastError !== null) {
    fail();
  }
  if (
    d.state === "blocked" &&
    (d.blockedAudit.consecutiveGoalTurns < 3 ||
      d.blockedAudit.conditionId === null)
  )
    fail();
  if (d.goal?.status === "complete" && d.state !== "complete") fail();
  if (d.state === "complete" && d.goal?.status !== "complete") fail();
  if (d.goal !== null) {
    if ((d.goal.status === "blocked") !== (d.state === "blocked")) fail();
  }
  if (
    d.state === "complete" &&
    (d.steps.some((step) => step.status !== "completed") ||
      d.verification.some(
        (verification) =>
          verification.required &&
          !["passed", "skipped"].includes(verification.status),
      ))
  )
    fail();
  const normalized = normalizeMilestones(d);
  if (normalized.milestones.some((m, i) => m.status !== d.milestones[i].status))
    fail();
  return d;
}

function telemetry(x, kind) {
  if (!x || typeof x !== "object" || Array.isArray(x)) fail();
  enumv(x.availability, ["unavailable", "reported", "derived"]);
  if (x.availability === "unavailable") {
    obj(x, ["availability"]);
  } else {
    obj(x, ["availability", "value", "source", "observedAt"]);
    if (typeof x.value !== "number" || x.value < 0) fail();
    text(x.source, 500);
    timestamp(x.observedAt);
    if (kind === "tokens" && x.availability !== "reported") fail();
  }
}

export function normalizeMilestones(input) {
  const d = safeClone(input);
  const blocking = d.blockers.filter(
    (b) => b.status === "open" && b.severity === "blocking",
  );
  for (const m of d.milestones) {
    const ss = d.steps.filter((s) => s.milestoneId === m.id);
    const isBlocked = blocking.some(
      (b) => b.milestoneId === m.id || ss.some((s) => s.id === b.stepId),
    );
    const verified = (s) =>
      s.status === "completed" &&
      s.verificationIds
        .map((id) => d.verification.find((v) => v.id === id))
        .filter((v) => v.required)
        .every((v) => ["passed", "skipped"].includes(v.status));
    if (ss.length > 0 && ss.every(verified)) m.status = "completed";
    else if (isBlocked) m.status = "blocked";
    else if (
      ss.some((s) => s.status === "in_progress" || s.status === "completed")
    )
      m.status = "in_progress";
    else m.status = "pending";
  }
  return d;
}

export function deriveProgress(input, nowMs = Date.now()) {
  const d = validateProgressDocument(input);
  const verified = (s) =>
    s.status === "completed" &&
    s.verificationIds
      .map((id) => d.verification.find((v) => v.id === id))
      .filter((v) => v.required)
      .every((v) => ["passed", "skipped"].includes(v.status));
  const count = d.steps.filter(verified).length;
  const blocking = d.blockers.filter(
    (b) => b.status === "open" && b.severity === "blocking",
  );
  let focus = d.steps.find((s) => s.status === "in_progress");
  if (!focus && blocking[0])
    focus =
      d.steps.find((s) => s.id === blocking[0].stepId) ||
      d.milestones.find((m) => m.id === blocking[0].milestoneId);
  if (!focus)
    focus =
      d.steps.find(
        (s) =>
          s.status === "pending" &&
          !blocking.some(
            (b) => b.stepId === s.id || b.milestoneId === s.milestoneId,
          ),
      ) || null;
  return {
    verifiedStepCount: count,
    totalStepCount: d.steps.length,
    progressLabel: d.steps.length
      ? `${count}/${d.steps.length} verified · derived`
      : "No tasks yet",
    progressPercent: d.steps.length
      ? Math.round((count / d.steps.length) * 100)
      : null,
    currentFocus: focus,
    health: {
      blocking: blocking.length,
      watch: d.blockers.filter(
        (b) => b.status === "open" && b.severity === "watch",
      ).length,
      openDecisions: d.decisions.filter((x) => x.status === "open").length,
      projection: d.planProjection.status,
    },
    stale: nowMs - Date.parse(d.updatedAt) > d.staleAfterMs,
  };
}

export function prepareInitialDocument(input, { now, randomUUID }) {
  const packageValue = safeClone(input.package);
  const verificationSupplied = Object.prototype.hasOwnProperty.call(
    input,
    "verification",
  );
  const steps = safeClone(input.steps ?? []);
  const verification = verificationSupplied
    ? safeClone(input.verification)
    : [...new Set(steps.flatMap((step) => step.verificationIds ?? []))].map(
        (verificationId) => ({
          id: verificationId,
          label: `Planned verification ${verificationId}`,
          status: "planned",
          required: true,
          stepIds: steps
            .filter((step) => step.verificationIds?.includes(verificationId))
            .map((step) => step.id),
          summary: null,
          observedAt: null,
          evidenceRefs: [],
          skipReason: null,
          approvalDecisionId: null,
        }),
      );
  const d = {
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    packageRevision: 1,
    planRevision: 1,
    createdAt: now,
    updatedAt: now,
    package: packageValue,
    goal: null,
    activation: {
      stateId: randomUUID(),
      status: "awaiting_approval",
      attempt: 0,
      approvedPackageRevision: null,
      approvedPlanRevision: null,
      approvedAt: null,
      permissionConsumedAt: null,
      associatedGoal: null,
      lastError: null,
      runtime: "codex",
    },
    milestones: safeClone(input.milestones ?? []),
    steps,
    blockers: safeClone(input.blockers ?? []),
    decisions: safeClone(input.decisions ?? []),
    blockedAudit: {
      conditionId: null,
      lastObservedGoalTurnId: null,
      resumedAt: null,
      resetReason: null,
      consecutiveGoalTurns: 0,
    },
    activity: [],
    telemetry: {
      tokens: { availability: "unavailable" },
      elapsedMs: { availability: "unavailable" },
    },
    links: safeClone(input.links ?? []),
    state: "draft",
    error: null,
    staleAfterMs: STALE_AFTER_MS,
    planProjection: {
      status: "not_projected",
      lastProjectedPlanRevision: null,
      observedAt: null,
      lastError: null,
      client: "codex",
    },
    verification,
  };
  if (verificationSupplied) validateProgressDocument(d);
  return validateProgressDocument(normalizeMilestones(d));
}

export function prepareNextDocument(current, candidate, { now }) {
  const old = validateProgressDocument(current),
    next = safeClone(candidate);
  if (
    next.revision !== old.revision ||
    next.packageRevision !== old.packageRevision ||
    next.planRevision !== old.planRevision
  )
    fail("REVISION_TUPLE_MISMATCH");
  if (
    next.activation.stateId !== old.activation.stateId ||
    next.createdAt !== old.createdAt
  )
    fail("IMMUTABLE_IDENTITY");
  for (const collection of ["milestones", "steps", "verification"]) {
    const nextIds = next[collection].map(({ id }) => id).sort();
    const oldIds = old[collection].map(({ id }) => id).sort();
    if (JSON.stringify(nextIds) !== JSON.stringify(oldIds))
      fail("IMMUTABLE_IDENTITY");
  }
  if (
    old.activation.associatedGoal !== null &&
    JSON.stringify(next.activation.associatedGoal) !==
      JSON.stringify(old.activation.associatedGoal)
  )
    fail("IMMUTABLE_ASSOCIATION");
  if (old.activation.associatedGoal !== null) {
    for (const key of [
      "attempt",
      "approvedPackageRevision",
      "approvedPlanRevision",
      "approvedAt",
      "permissionConsumedAt",
    ]) {
      if (next.activation[key] !== old.activation[key])
        fail("IMMUTABLE_ACTIVATION");
    }
    for (const key of ["id", "title", "objective", "source"]) {
      if (next.goal?.[key] !== old.goal?.[key]) fail("IMMUTABLE_GOAL");
    }
  }
  if (
    old.activation.associatedGoal === null &&
    next.activation.associatedGoal !== null &&
    (old.activation.permissionConsumedAt === null ||
      next.activation.attempt !== old.activation.attempt ||
      next.activation.status !== "active" ||
      next.goal?.status !== "active")
  )
    fail("INVALID_ASSOCIATION");
  const addsAssociation =
    old.activation.associatedGoal === null &&
    next.activation.associatedGoal !== null;
  if (
    addsAssociation &&
    !next.goal?.objective?.includes(old.activation.stateId)
  ) {
    fail("OBJECTIVE_STATE_ID_MISSING");
  }
  const hasOverLimitObjective =
    typeof next.goal?.objective === "string" &&
    next.goal.objective.length > MAX_NEW_GOAL_OBJECTIVE_CHARACTERS;
  const isLegacyObjectiveRecovery =
    addsAssociation &&
    hasOverLimitObjective &&
    next.goal.objective.length === MAX_PERSISTED_GOAL_OBJECTIVE_CHARACTERS &&
    old.activation.status === "conflict" &&
    old.activation.permissionConsumedAt !== null &&
    old.activation.approvedPackageRevision !== null &&
    old.activation.approvedPlanRevision !== null &&
    old.activation.approvedAt !== null &&
    isDeepStrictEqual(
      old.activation.lastError,
      LEGACY_ASSOCIATION_REJECTED_ERROR,
    ) &&
    next.goal.objective.includes(old.activation.stateId) &&
    next.activation.lastError === null;
  if (addsAssociation && hasOverLimitObjective && !isLegacyObjectiveRecovery) {
    fail("LEGACY_RECOVERY_REQUIRED");
  }
  if (old.activation.permissionConsumedAt !== null) {
    if (next.activation.attempt < old.activation.attempt)
      fail("CONSUMED_PERMISSION");
    if (next.activation.attempt === old.activation.attempt) {
      for (const key of [
        "approvedPackageRevision",
        "approvedPlanRevision",
        "approvedAt",
        "permissionConsumedAt",
      ]) {
        if (next.activation[key] !== old.activation[key])
          fail("CONSUMED_PERMISSION");
      }
    } else if (next.activation.attempt !== old.activation.attempt + 1) {
      fail("INVALID_ATTEMPT");
    }
    if (
      old.activation.lastError !== null &&
      next.activation.attempt === old.activation.attempt &&
      !isDeepStrictEqual(
        next.activation.lastError,
        old.activation.lastError,
      ) &&
      !isLegacyObjectiveRecovery
    )
      fail("FAILED_ATTEMPT_CONSUMED");
    if (next.activation.attempt === old.activation.attempt + 1) {
      if (
        next.activation.lastError !== null ||
        next.activation.approvedAt === old.activation.approvedAt ||
        next.activation.permissionConsumedAt ===
          old.activation.permissionConsumedAt
      )
        fail("FRESH_PERMISSION_REQUIRED");
    }
  }
  if (
    old.activation.permissionConsumedAt === null &&
    next.activation.permissionConsumedAt !== null &&
    next.activation.attempt !== old.activation.attempt + 1
  )
    fail("FRESH_PERMISSION_REQUIRED");
  const on = normalizeMilestones(old),
    nn = normalizeMilestones(next);
  const pkgChanged = JSON.stringify(on.package) !== JSON.stringify(nn.package);
  const planShape = (x) => ({
    milestones: x.milestones.map(({ id, title, status, stepIds }) => ({
      id,
      title,
      status,
      stepIds,
    })),
    steps: x.steps.map(
      ({ id, milestoneId, title, status, verificationIds }) => ({
        id,
        milestoneId,
        title,
        status,
        verificationIds,
      }),
    ),
  });
  const planChanged =
    JSON.stringify(planShape(on)) !== JSON.stringify(planShape(nn));
  nn.revision = old.revision + 1;
  nn.packageRevision = old.packageRevision + (pkgChanged ? 1 : 0);
  nn.planRevision = old.planRevision + (planChanged ? 1 : 0);
  nn.updatedAt = now;
  if (nn.planProjection.status === "error") {
    nn.planProjection.lastProjectedPlanRevision =
      old.planProjection.lastProjectedPlanRevision;
  }
  if ((pkgChanged || planChanged) && old.activation.status !== "active") {
    Object.assign(nn.activation, {
      status: "awaiting_approval",
      approvedPackageRevision: null,
      approvedPlanRevision: null,
      approvedAt: null,
      permissionConsumedAt: null,
    });
  }
  if (planChanged) {
    if (nn.activation.status === "active")
      Object.assign(nn.planProjection, { status: "stale", lastError: null });
    else
      Object.assign(nn.planProjection, {
        status: "not_projected",
        lastProjectedPlanRevision: null,
        observedAt: null,
        lastError: null,
      });
  }
  if (nn.activation.status !== "active") {
    Object.assign(nn.planProjection, {
      status: "not_projected",
      lastProjectedPlanRevision: null,
      observedAt: null,
      lastError: null,
    });
  }
  nn.activity = nn.activity.sort((a, b) => a.seq - b.seq).slice(-100);
  return validateProgressDocument(nn);
}

export function advanceBlockedAudit(
  current,
  { conditionId, goalTurnId, resumed, now },
) {
  if (!STATE_ID.test(goalTurnId)) fail("INVALID_GOAL_TURN");
  const out = safeClone(current);
  if (resumed) {
    out.conditionId = null;
    out.lastObservedGoalTurnId = null;
    out.consecutiveGoalTurns = 0;
    out.resumedAt = now;
    out.resetReason = "resumed";
  }
  if (out.lastObservedGoalTurnId === goalTurnId) return out;
  if (conditionId === null) {
    out.conditionId = null;
    out.consecutiveGoalTurns = 0;
    out.resetReason = "condition_cleared";
  } else if (out.conditionId === conditionId) {
    out.consecutiveGoalTurns += 1;
    out.resetReason = null;
  } else {
    out.conditionId = conditionId;
    out.consecutiveGoalTurns = 1;
    out.resetReason = "condition_changed";
  }
  out.lastObservedGoalTurnId = goalTurnId;
  return out;
}

function stateError(code, exitCode = 1) {
  return new SuperifyStateError(
    code,
    "Superify state operation failed.",
    exitCode,
  );
}

function assertStateId(stateId) {
  if (typeof stateId !== "string" || !STATE_ID.test(stateId)) {
    throw stateError("INVALID_STATE_ID");
  }
}

function assertContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  ) {
    return;
  }
  throw stateError("UNSAFE_STATE_PATH");
}

export function defaultStateRoot(env = process.env, home = os.homedir()) {
  const configured = env?.XDG_STATE_HOME;
  if (configured !== undefined && !path.isAbsolute(configured)) {
    throw stateError("INVALID_STATE_ROOT");
  }
  const base = configured || path.join(home, ".local", "state");
  return path.join(base, "superify");
}

export function resolveStatePaths({ stateId, env = process.env } = {}) {
  assertStateId(stateId);
  const stateRoot = defaultStateRoot(env);
  const goalsRoot = path.join(stateRoot, "goals");
  const goalDir = path.join(goalsRoot, stateId);
  assertContained(stateRoot, goalDir);
  return {
    stateRoot,
    goalsRoot,
    goalDir,
    progressPath: path.join(goalDir, "progress.json"),
    lockPath: path.join(goalDir, ".writer.lock"),
  };
}

function xdgBaseFor(env = process.env) {
  return path.dirname(defaultStateRoot(env));
}

async function lstatOptional(fsOps, target) {
  try {
    return await fsOps.lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw stateError("UNSAFE_STATE_PATH");
  }
}

function rejectSymlinkOrWrongType(stat, type = "directory") {
  if (stat.isSymbolicLink()) throw stateError("SYMLINK_REJECTED");
  const valid = type === "directory" ? stat.isDirectory() : stat.isFile();
  if (!valid) throw stateError("UNSAFE_STATE_PATH");
}

function sameInode(left, right) {
  return Boolean(
    left && right && left.dev === right.dev && left.ino === right.ino,
  );
}

function verifySecureOwnedDirectory(stat) {
  if (process.platform === "win32") return;
  if ((stat.mode & 0o777) !== 0o700) throw stateError("UNSAFE_STATE_MODE");
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw stateError("UNSAFE_STATE_OWNER");
  }
}

async function inspectAncestorChain(
  fsOps,
  target,
  { allowMissing = false } = {},
) {
  const absolute = path.resolve(target);
  const root = path.parse(absolute).root;
  let cursor = root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  for (const part of parts) {
    cursor = path.join(cursor, part);
    const stat = await lstatOptional(fsOps, cursor);
    if (!stat) {
      if (allowMissing) return;
      throw stateError("STATE_NOT_FOUND", 2);
    }
    rejectSymlinkOrWrongType(stat, "directory");
  }
}

async function anchorDirectory(fsOps, target, { secure = false } = {}) {
  const stat = await lstatOptional(fsOps, target);
  if (!stat) throw stateError("STATE_NOT_FOUND", 2);
  rejectSymlinkOrWrongType(stat, "directory");
  if (secure) verifySecureOwnedDirectory(stat);
  let canonical;
  try {
    canonical = await fsOps.realpath(target);
  } catch {
    throw stateError("UNSAFE_STATE_PATH");
  }
  if (path.resolve(canonical) !== path.resolve(target)) {
    throw stateError("SYMLINK_REJECTED");
  }
  return { path: target, canonical, stat };
}

async function capturePathAnchors(fsOps, paths) {
  // Node exposes no descriptor-relative openat workflow. These canonical inode
  // anchors cannot make separate syscalls indivisible, but every swap observed
  // at a boundary below is treated as fatal and is never reported successful.
  await inspectAncestorChain(fsOps, paths.goalDir);
  return {
    stateRoot: await anchorDirectory(fsOps, paths.stateRoot, { secure: true }),
    goalsRoot: await anchorDirectory(fsOps, paths.goalsRoot, { secure: true }),
    goalDir: await anchorDirectory(fsOps, paths.goalDir, { secure: true }),
  };
}

async function assertPathAnchors(fsOps, anchors) {
  for (const anchor of Object.values(anchors)) {
    const current = await lstatOptional(fsOps, anchor.path);
    if (!current || current.isSymbolicLink() || !current.isDirectory()) {
      throw stateError("UNSAFE_STATE_PATH");
    }
    if (!sameInode(current, anchor.stat)) throw stateError("UNSAFE_STATE_PATH");
    verifySecureOwnedDirectory(current);
    let canonical;
    try {
      canonical = await fsOps.realpath(anchor.path);
    } catch {
      throw stateError("UNSAFE_STATE_PATH");
    }
    if (path.resolve(canonical) !== path.resolve(anchor.canonical)) {
      throw stateError("UNSAFE_STATE_PATH");
    }
  }
}

async function nearestExistingAncestor(target, fsOps) {
  let cursor = target;
  const missing = [];
  for (;;) {
    const stat = await lstatOptional(fsOps, cursor);
    if (stat) {
      rejectSymlinkOrWrongType(stat, "directory");
      return { ancestor: cursor, missing: missing.reverse() };
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) throw stateError("UNSAFE_STATE_PATH");
    missing.push(cursor);
    cursor = parent;
  }
}

async function mkdirOwned(fsOps, target) {
  try {
    await fsOps.mkdir(target, { mode: 0o700 });
    await fsOps.chmod(target, 0o700);
    return true;
  } catch (error) {
    if (error?.code === "EEXIST") return false;
    throw stateError("STATE_PATH_CREATE_FAILED");
  }
}

async function inspectExistingDirectory(
  fsOps,
  target,
  missingCode = "STATE_NOT_FOUND",
) {
  const stat = await lstatOptional(fsOps, target);
  if (!stat) throw stateError(missingCode, 2);
  rejectSymlinkOrWrongType(stat, "directory");
  verifySecureOwnedDirectory(stat);
  return stat;
}

async function inspectReadOnlyPaths({
  stateId,
  env,
  fsOps,
  includeFinal = true,
}) {
  const paths = resolveStatePaths({ stateId, env });
  await inspectAncestorChain(fsOps, paths.goalDir, { allowMissing: false });
  await inspectExistingDirectory(fsOps, paths.stateRoot);
  await inspectExistingDirectory(fsOps, paths.goalsRoot);
  await inspectExistingDirectory(fsOps, paths.goalDir);
  const lockStat = await lstatOptional(fsOps, paths.lockPath);
  if (lockStat?.isSymbolicLink()) throw stateError("SYMLINK_REJECTED");
  if (lockStat && !lockStat.isFile()) throw stateError("UNSAFE_STATE_PATH");
  if (includeFinal) {
    const stat = await lstatOptional(fsOps, paths.progressPath);
    if (!stat) throw stateError("STATE_NOT_FOUND", 2);
    rejectSymlinkOrWrongType(stat, "file");
  }
  return { ...paths, anchors: await capturePathAnchors(fsOps, paths) };
}

async function setupWritableStatePaths({
  stateId,
  env,
  fsOps,
  reserveGoal = false,
}) {
  const paths = resolveStatePaths({ stateId, env });
  const xdgBase = xdgBaseFor(env);
  const createdDirectories = [];
  await inspectAncestorChain(fsOps, xdgBase, { allowMissing: true });
  const { missing } = await nearestExistingAncestor(xdgBase, fsOps);
  for (const target of missing) {
    if (await mkdirOwned(fsOps, target)) createdDirectories.push(target);
    const stat = await lstatOptional(fsOps, target);
    rejectSymlinkOrWrongType(stat, "directory");
  }
  for (const target of [paths.stateRoot, paths.goalsRoot]) {
    const existing = await lstatOptional(fsOps, target);
    if (existing) {
      rejectSymlinkOrWrongType(existing, "directory");
      verifySecureOwnedDirectory(existing);
    } else {
      if (await mkdirOwned(fsOps, target)) createdDirectories.push(target);
      rejectSymlinkOrWrongType(await lstatOptional(fsOps, target), "directory");
    }
  }
  const existingGoal = await lstatOptional(fsOps, paths.goalDir);
  if (existingGoal) {
    rejectSymlinkOrWrongType(existingGoal, "directory");
    verifySecureOwnedDirectory(existingGoal);
    if (reserveGoal) throw stateError("STATE_EXISTS", 2);
  } else {
    try {
      await fsOps.mkdir(paths.goalDir, { mode: 0o700 });
      await fsOps.chmod(paths.goalDir, 0o700);
      createdDirectories.push(paths.goalDir);
    } catch (error) {
      if (error?.code === "EEXIST") {
        const raced = await lstatOptional(fsOps, paths.goalDir);
        if (raced?.isSymbolicLink()) throw stateError("SYMLINK_REJECTED");
        throw stateError(reserveGoal ? "STATE_EXISTS" : "LOCK_HELD", 2);
      }
      throw stateError("STATE_PATH_CREATE_FAILED");
    }
  }
  for (const target of [paths.stateRoot, paths.goalsRoot, paths.goalDir]) {
    const stat = await lstatOptional(fsOps, target);
    rejectSymlinkOrWrongType(stat, "directory");
    verifySecureOwnedDirectory(stat);
  }
  const anchored = { ...paths, xdgBase, createdDirectories };
  anchored.anchors = await capturePathAnchors(fsOps, anchored);
  return anchored;
}

export async function ensureWritableStatePaths({
  stateId,
  env = process.env,
  fsOps = fs.promises,
} = {}) {
  return setupWritableStatePaths({ stateId, env, fsOps });
}

function noFollowFlag() {
  return fs.constants.O_NOFOLLOW ?? 0;
}

async function verifyOpenedFile(
  fsOps,
  target,
  handle,
  priorStat = null,
  { enforceMode = true } = {},
) {
  const before = priorStat ?? (await lstatOptional(fsOps, target));
  if (!before) throw stateError("STATE_NOT_FOUND", 2);
  rejectSymlinkOrWrongType(before, "file");
  const opened = await handle.stat();
  if (
    !opened.isFile() ||
    opened.dev !== before.dev ||
    opened.ino !== before.ino
  ) {
    throw stateError("UNSAFE_STATE_PATH");
  }
  if (
    enforceMode &&
    process.platform !== "win32" &&
    (opened.mode & 0o777) !== 0o600
  ) {
    throw stateError("UNSAFE_STATE_MODE");
  }
  if (typeof process.getuid === "function" && opened.uid !== process.getuid()) {
    throw stateError("UNSAFE_STATE_OWNER");
  }
}

async function readDocumentAt(paths, fsOps) {
  await assertPathAnchors(fsOps, paths.anchors);
  const prior = await lstatOptional(fsOps, paths.progressPath);
  if (!prior) throw stateError("STATE_NOT_FOUND", 2);
  rejectSymlinkOrWrongType(prior, "file");
  let handle;
  try {
    handle = await fsOps.open(
      paths.progressPath,
      fs.constants.O_RDONLY | noFollowFlag(),
    );
    await verifyOpenedFile(fsOps, paths.progressPath, handle, prior);
    await assertPathAnchors(fsOps, paths.anchors);
    const buffer = Buffer.alloc(MAX_DOCUMENT_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_DOCUMENT_BYTES) throw stateError("DOCUMENT_TOO_LARGE");
    let parsed;
    try {
      if (offset === 0 || buffer[offset - 1] !== 0x0a) {
        throw stateError("INVALID_STORED_STATE");
      }
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, offset - 1),
      );
      parsed = JSON.parse(decoded);
      await assertPathAnchors(fsOps, paths.anchors);
      return validateProgressDocument(parsed);
    } catch (error) {
      if (
        error instanceof SuperifyStateError &&
        error.code === "DOCUMENT_TOO_LARGE"
      )
        throw error;
      throw stateError("INVALID_STORED_STATE");
    }
  } catch (error) {
    if (error instanceof SuperifyStateError) throw error;
    if (error?.code === "ELOOP") throw stateError("SYMLINK_REJECTED");
    if (error?.code === "ENOENT") throw stateError("STATE_NOT_FOUND", 2);
    throw stateError("STATE_READ_FAILED");
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

export async function readState({
  stateId,
  env = process.env,
  fsOps = fs.promises,
} = {}) {
  assertStateId(stateId);
  const paths = await inspectReadOnlyPaths({ stateId, env, fsOps });
  const document = await readDocumentAt(paths, fsOps);
  if (document.activation.stateId !== stateId)
    throw stateError("STATE_ID_MISMATCH");
  const { anchors: _anchors, ...publicPaths } = paths;
  return { ...publicPaths, document };
}

export async function inspectStatePaths({
  stateId,
  env = process.env,
  fsOps = fs.promises,
} = {}) {
  assertStateId(stateId);
  const { anchors: _anchors, ...publicPaths } = await inspectReadOnlyPaths({
    stateId,
    env,
    fsOps,
    includeFinal: true,
  });
  return publicPaths;
}

async function acquireLock(
  paths,
  fsOps,
  {
    now = new Date().toISOString(),
    hostname = os.hostname(),
    pid = process.pid,
  } = {},
) {
  let handle;
  let stat;
  try {
    await assertPathAnchors(fsOps, paths.anchors);
    handle = await fsOps.open(
      paths.lockPath,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        noFollowFlag(),
      0o600,
    );
    stat = await handle.stat();
    if (!stat.isFile()) throw stateError("UNSAFE_STATE_PATH");
    await assertPathAnchors(fsOps, paths.anchors);
    if (process.platform !== "win32") await handle.chmod(0o600);
    await handle.writeFile(
      `${JSON.stringify({ pid, hostname, createdAt: now })}\n`,
      "utf8",
    );
    await handle.sync();
    const finalStat = await handle.stat();
    if (
      !sameInode(stat, finalStat) ||
      (process.platform !== "win32" && (finalStat.mode & 0o777) !== 0o600)
    ) {
      throw stateError("UNSAFE_STATE_PATH");
    }
    await assertPathAnchors(fsOps, paths.anchors);
    return { handle, stat };
  } catch (error) {
    if (handle && stat) {
      try {
        await quarantineOwnedLock(paths, fsOps, { handle, stat });
      } catch (cleanupError) {
        throw cleanupError;
      }
    } else if (handle) {
      try {
        stat = await handle.stat();
        await quarantineOwnedLock(paths, fsOps, { handle, stat });
      } catch (cleanupError) {
        if (stat) throw cleanupError;
        await handle.close().catch(() => {});
      }
    }
    if (error instanceof SuperifyStateError) throw error;
    if (error?.code === "EEXIST") throw stateError("LOCK_HELD", 2);
    if (error?.code === "ELOOP") throw stateError("SYMLINK_REJECTED");
    throw stateError("LOCK_FAILED");
  }
}

async function quarantineOwnedLock(paths, fsOps, lock) {
  let closeFailed = false;
  try {
    await lock.handle.close();
  } catch {
    closeFailed = true;
    try {
      await lock.handle.close();
    } catch {
      throw stateError("LOCK_CLEANUP_FAILED");
    }
  }
  await assertPathAnchors(fsOps, paths.anchors);
  const quarantinePath = path.join(
    paths.goalDir,
    `.writer.lock.${process.pid}.${systemRandomUUID()}.quarantine`,
  );
  assertContained(paths.goalDir, quarantinePath);
  try {
    const current = await fsOps.lstat(paths.lockPath);
    if (
      current.isSymbolicLink() ||
      !current.isFile() ||
      !sameInode(current, lock.stat)
    ) {
      throw stateError("LOCK_OWNERSHIP_LOST");
    }
    await assertPathAnchors(fsOps, paths.anchors);
    await fsOps.rename(paths.lockPath, quarantinePath);
  } catch (error) {
    if (error?.code === "ENOENT") throw stateError("LOCK_OWNERSHIP_LOST");
    if (error instanceof SuperifyStateError) throw error;
    throw stateError("LOCK_CLEANUP_FAILED");
  }
  await assertPathAnchors(fsOps, paths.anchors);
  const quarantined = await lstatOptional(fsOps, quarantinePath);
  if (
    !quarantined ||
    quarantined.isSymbolicLink() ||
    !quarantined.isFile() ||
    !sameInode(quarantined, lock.stat)
  ) {
    const occupied = await lstatOptional(fsOps, paths.lockPath);
    if (!occupied) {
      try {
        await fsOps.rename(quarantinePath, paths.lockPath);
      } catch {
        // Leave the unowned quarantine intact if restoration cannot be proven.
      }
    }
    throw stateError("LOCK_OWNERSHIP_LOST");
  }
  const replacement = await lstatOptional(fsOps, paths.lockPath);
  try {
    await fsOps.unlink(quarantinePath);
  } catch {
    throw stateError("LOCK_CLEANUP_FAILED");
  }
  await assertPathAnchors(fsOps, paths.anchors);
  if (replacement) throw stateError("LOCK_OWNERSHIP_LOST");
  if (closeFailed) throw stateError("LOCK_CLEANUP_FAILED");
}

async function releaseLock(paths, fsOps, lock) {
  return quarantineOwnedLock(paths, fsOps, lock);
}

async function syncDirectory(
  fsOps,
  target,
  { platform = process.platform, durabilityRequired = false, anchors } = {},
) {
  let handle;
  try {
    if (anchors) await assertPathAnchors(fsOps, anchors);
    const prior = await lstatOptional(fsOps, target);
    if (!prior) throw stateError("DURABILITY_UNKNOWN");
    rejectSymlinkOrWrongType(prior, "directory");
    try {
      handle = await fsOps.open(target, fs.constants.O_RDONLY);
    } catch (error) {
      if (platform === "win32" && error?.code === "EISDIR") {
        if (durabilityRequired) throw stateError("DURABILITY_UNSUPPORTED");
        return false;
      }
      throw error;
    }
    const opened = await handle.stat();
    if (!opened.isDirectory() || !sameInode(prior, opened)) {
      throw stateError("DURABILITY_UNKNOWN");
    }
    try {
      await handle.sync();
    } catch (error) {
      if (platform === "win32" && ["EINVAL", "ENOTSUP"].includes(error?.code)) {
        if (durabilityRequired) throw stateError("DURABILITY_UNSUPPORTED");
        return false;
      }
      throw error;
    }
    const after = await lstatOptional(fsOps, target);
    if (!after || !sameInode(prior, after)) {
      throw stateError("DURABILITY_UNKNOWN");
    }
    if (anchors) await assertPathAnchors(fsOps, anchors);
    return true;
  } catch (error) {
    if (error instanceof SuperifyStateError) throw error;
    throw stateError("DURABILITY_UNKNOWN");
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // A failed close is still operational failure. Retry once only to avoid
        // leaking a descriptor when an injected/transient close fails before
        // reaching the underlying handle.
        await handle.close().catch(() => {});
        throw stateError("DURABILITY_UNKNOWN");
      }
    }
  }
}

function uniquePaths(values) {
  return [...new Set(values)];
}

async function assertNamedProgress(fsOps, paths, expectedStat) {
  const named = await lstatOptional(fsOps, paths.progressPath);
  if (
    !named ||
    named.isSymbolicLink() ||
    !named.isFile() ||
    !sameInode(named, expectedStat)
  ) {
    throw stateError("UNSAFE_STATE_PATH");
  }
  if (process.platform !== "win32" && (named.mode & 0o777) !== 0o600) {
    throw stateError("UNSAFE_STATE_MODE");
  }
  if (typeof process.getuid === "function" && named.uid !== process.getuid()) {
    throw stateError("UNSAFE_STATE_OWNER");
  }
}

async function atomicReplace({
  paths,
  document,
  fsOps,
  barrierDirectories,
  platform,
  durabilityRequired,
}) {
  const serialized = Buffer.from(`${JSON.stringify(document)}\n`, "utf8");
  if (serialized.byteLength > MAX_DOCUMENT_BYTES) {
    throw stateError("DOCUMENT_TOO_LARGE");
  }
  const tempPath = path.join(
    paths.goalDir,
    `.progress.${process.pid}.${systemRandomUUID()}.tmp`,
  );
  assertContained(paths.goalDir, tempPath);
  let handle;
  let tempStat;
  let renamed = false;
  try {
    await assertPathAnchors(fsOps, paths.anchors);
    handle = await fsOps.open(
      tempPath,
      fs.constants.O_WRONLY |
        fs.constants.O_CREAT |
        fs.constants.O_EXCL |
        noFollowFlag(),
      0o600,
    );
    tempStat = await handle.stat();
    if (!tempStat.isFile()) throw stateError("UNSAFE_STATE_PATH");
    await assertPathAnchors(fsOps, paths.anchors);
    if (process.platform !== "win32") await handle.chmod(0o600);
    await handle.writeFile(serialized);
    await handle.sync();
    const syncedTemp = await handle.stat();
    if (
      !sameInode(tempStat, syncedTemp) ||
      (process.platform !== "win32" && (syncedTemp.mode & 0o777) !== 0o600)
    ) {
      throw stateError("UNSAFE_STATE_PATH");
    }
    await handle.close();
    handle = null;
    await assertPathAnchors(fsOps, paths.anchors);
    const namedTemp = await lstatOptional(fsOps, tempPath);
    if (!namedTemp || !sameInode(namedTemp, tempStat)) {
      throw stateError("UNSAFE_STATE_PATH");
    }
    await fsOps.rename(tempPath, paths.progressPath);
    renamed = true;
    await assertPathAnchors(fsOps, paths.anchors);
    const finalNamed = await lstatOptional(fsOps, paths.progressPath);
    if (!finalNamed || !sameInode(finalNamed, tempStat)) {
      throw stateError("UNSAFE_STATE_PATH");
    }
    let finalHandle;
    try {
      finalHandle = await fsOps.open(
        paths.progressPath,
        fs.constants.O_RDWR | noFollowFlag(),
      );
      await verifyOpenedFile(
        fsOps,
        paths.progressPath,
        finalHandle,
        finalNamed,
        { enforceMode: false },
      );
      if (process.platform !== "win32") await finalHandle.chmod(0o600);
      const securedFinal = await finalHandle.stat();
      if (
        !sameInode(securedFinal, tempStat) ||
        (process.platform !== "win32" && (securedFinal.mode & 0o777) !== 0o600)
      ) {
        throw stateError("UNSAFE_STATE_PATH");
      }
    } finally {
      if (finalHandle) await finalHandle.close();
    }
    await assertPathAnchors(fsOps, paths.anchors);
    await assertNamedProgress(fsOps, paths, tempStat);
    for (const directory of uniquePaths(barrierDirectories)) {
      await syncDirectory(fsOps, directory, {
        platform,
        durabilityRequired,
        anchors: paths.anchors,
      });
    }
    await assertPathAnchors(fsOps, paths.anchors);
    await assertNamedProgress(fsOps, paths, tempStat);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (!renamed && tempStat) {
      const namedTemp = await lstatOptional(fsOps, tempPath).catch(() => null);
      if (namedTemp && sameInode(namedTemp, tempStat)) {
        await fsOps.unlink(tempPath).catch(() => {});
      }
    }
    if (renamed) {
      if (
        error instanceof SuperifyStateError &&
        [
          "DURABILITY_UNKNOWN",
          "DURABILITY_UNSUPPORTED",
          "UNSAFE_STATE_PATH",
          "SYMLINK_REJECTED",
        ].includes(error.code)
      )
        throw error;
      throw stateError("DURABILITY_UNKNOWN");
    }
    if (error instanceof SuperifyStateError) throw error;
    throw stateError("STATE_WRITE_FAILED");
  }
}

function nowValue(now) {
  return typeof now === "function" ? now() : (now ?? new Date().toISOString());
}

export async function initializeState(input, deps = {}) {
  assertStateId(deps.stateId);
  const now = nowValue(deps.now);
  const document = prepareInitialDocument(input, {
    now,
    randomUUID: () => deps.stateId,
  });
  assertStateId(document.activation.stateId);
  const fsOps = deps.fsOps ?? fs.promises;
  const env = deps.env ?? process.env;
  let paths;
  try {
    paths = await setupWritableStatePaths({
      stateId: document.activation.stateId,
      env,
      fsOps,
      reserveGoal: true,
    });
  } catch (error) {
    if (!(error instanceof SuperifyStateError) || error.code !== "STATE_EXISTS") {
      throw error;
    }
    let replayPaths;
    try {
      replayPaths = await inspectReadOnlyPaths({
        stateId: deps.stateId,
        env,
        fsOps,
        includeFinal: true,
      });
    } catch (pathError) {
      if (
        pathError instanceof SuperifyStateError &&
        pathError.code === "STATE_NOT_FOUND"
      ) {
        throw stateError("INIT_IN_PROGRESS", 2);
      }
      throw pathError;
    }
    let replayLock;
    try {
      try {
        replayLock = await acquireLock(replayPaths, fsOps, {
          now,
          hostname:
            typeof deps.hostname === "function"
              ? deps.hostname()
              : (deps.hostname ?? os.hostname()),
          pid: deps.pid ?? process.pid,
        });
      } catch (lockError) {
        if (
          lockError instanceof SuperifyStateError &&
          lockError.code === "LOCK_HELD"
        ) {
          throw stateError("INIT_IN_PROGRESS", 2);
        }
        throw lockError;
      }
      let existing;
      try {
        existing = await readDocumentAt(replayPaths, fsOps);
      } catch (readError) {
        if (
          readError instanceof SuperifyStateError &&
          readError.code === "STATE_NOT_FOUND"
        ) {
          throw stateError("INIT_IN_PROGRESS", 2);
        }
        throw readError;
      }
      if (existing.activation.stateId !== deps.stateId) {
        throw stateError("STATE_ID_MISMATCH");
      }
      if (existing.revision !== 1) {
        throw stateError("INIT_STATE_ADVANCED", 2);
      }
      const expected = prepareInitialDocument(input, {
        now: existing.createdAt,
        randomUUID: () => deps.stateId,
      });
      if (!isDeepStrictEqual(existing, expected)) {
        throw stateError("INIT_BINDING_MISMATCH", 2);
      }
      const beforeBarrier = await lstatOptional(fsOps, replayPaths.progressPath);
      if (!beforeBarrier) throw stateError("INIT_IN_PROGRESS", 2);
      rejectSymlinkOrWrongType(beforeBarrier, "file");
      for (const directory of [
        replayPaths.goalDir,
        replayPaths.goalsRoot,
        replayPaths.stateRoot,
        xdgBaseFor(env),
      ]) {
        await syncDirectory(fsOps, directory, {
          platform: deps.platform ?? process.platform,
          durabilityRequired: true,
          anchors: replayPaths.anchors,
        });
      }
      await assertPathAnchors(fsOps, replayPaths.anchors);
      const afterBarrier = await lstatOptional(fsOps, replayPaths.progressPath);
      if (!afterBarrier || !sameInode(beforeBarrier, afterBarrier)) {
        throw stateError("DURABILITY_UNKNOWN");
      }
      const confirmed = await readDocumentAt(replayPaths, fsOps);
      const finalStat = await lstatOptional(fsOps, replayPaths.progressPath);
      if (
        !finalStat ||
        !sameInode(beforeBarrier, finalStat) ||
        !isDeepStrictEqual(confirmed, existing)
      ) {
        throw stateError("DURABILITY_UNKNOWN");
      }
      const { anchors: _anchors, ...publicPaths } = replayPaths;
      return { ...publicPaths, document: confirmed };
    } finally {
      if (replayLock) await releaseLock(replayPaths, fsOps, replayLock);
    }
  }
  let lock;
  try {
    lock = await acquireLock(paths, fsOps, {
      now,
      hostname:
        typeof deps.hostname === "function"
          ? deps.hostname()
          : (deps.hostname ?? os.hostname()),
      pid: deps.pid ?? process.pid,
    });
    const createdParentBarriers = paths.createdDirectories
      .slice()
      .reverse()
      .map((directory) => path.dirname(directory));
    await atomicReplace({
      paths,
      document,
      fsOps,
      barrierDirectories: [paths.goalDir, ...createdParentBarriers],
      platform: deps.platform ?? process.platform,
      durabilityRequired: true,
    });
    const { anchors: _anchors, ...publicPaths } = paths;
    return { ...publicPaths, document };
  } finally {
    if (lock) await releaseLock(paths, fsOps, lock);
  }
}

export async function updateState({
  stateId,
  expectedRevision,
  candidate,
  env = process.env,
  fsOps = fs.promises,
  now,
  platform = process.platform,
  hostname = os.hostname(),
  pid = process.pid,
} = {}) {
  assertStateId(stateId);
  integer(expectedRevision, 0);
  validateProgressDocument(candidate);
  const paths = await inspectReadOnlyPaths({ stateId, env, fsOps });
  const lockStat = await lstatOptional(fsOps, paths.lockPath);
  if (lockStat) {
    if (lockStat.isSymbolicLink()) throw stateError("SYMLINK_REJECTED");
    throw stateError("LOCK_HELD", 2);
  }
  const progressStat = await lstatOptional(fsOps, paths.progressPath);
  if (!progressStat) throw stateError("STATE_NOT_FOUND", 2);
  rejectSymlinkOrWrongType(progressStat, "file");
  const operationNow = nowValue(now);
  const lock = await acquireLock(paths, fsOps, {
    now: operationNow,
    hostname: typeof hostname === "function" ? hostname() : hostname,
    pid,
  });
  try {
    const current = await readDocumentAt(paths, fsOps);
    if (current.activation.stateId !== stateId)
      throw stateError("STATE_ID_MISMATCH");
    if (current.revision !== expectedRevision) {
      throw stateError("REVISION_CONFLICT", 2);
    }
    const document = prepareNextDocument(current, candidate, {
      now: operationNow,
    });
    const activationCheckpoint =
      document.activation.permissionConsumedAt !==
        current.activation.permissionConsumedAt ||
      JSON.stringify(document.activation.associatedGoal) !==
        JSON.stringify(current.activation.associatedGoal);
    await atomicReplace({
      paths,
      document,
      fsOps,
      barrierDirectories: activationCheckpoint
        ? [paths.goalDir, paths.goalsRoot, paths.stateRoot, xdgBaseFor(env)]
        : [paths.goalDir],
      platform,
      durabilityRequired: activationCheckpoint,
    });
    const { anchors: _anchors, ...publicPaths } = paths;
    return { ...publicPaths, document };
  } finally {
    await releaseLock(paths, fsOps, lock);
  }
}

const CLI_COMMANDS = new Set([
  "init",
  "read",
  "path",
  "update",
  "recover-lock",
]);
const CLI_HELP = `Usage: superify-state.mjs <command> [options]

Commands:
  init --state-id <uuid> --input <file|->
  read --state-id <uuid>
  path --state-id <uuid>
  update --state-id <uuid> --expected-revision <n> --input <file|->
  recover-lock --state-id <uuid>
`;

export function parseArgs(argv) {
  if (!Array.isArray(argv)) throw stateError("INVALID_ARGUMENTS");
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
    return { help: true };
  }
  const [command, ...tokens] = argv;
  if (!command || !CLI_COMMANDS.has(command)) {
    throw stateError("UNKNOWN_COMMAND");
  }
  const allowed = {
    init: new Set(["state-id", "input"]),
    read: new Set(["state-id"]),
    path: new Set(["state-id"]),
    update: new Set(["state-id", "expected-revision", "input"]),
    "recover-lock": new Set(["state-id"]),
  }[command];
  const options = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    if (typeof flag !== "string" || !flag.startsWith("--")) {
      throw stateError("UNKNOWN_ARGUMENT");
    }
    const key = flag.slice(2);
    if (!allowed.has(key)) throw stateError("UNKNOWN_ARGUMENT");
    if (Object.prototype.hasOwnProperty.call(options, key)) {
      throw stateError("DUPLICATE_ARGUMENT");
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw stateError("MISSING_ARGUMENT");
    }
    options[key] = value;
  }
  if ([...allowed].some((key) => !(key in options))) {
    throw stateError("MISSING_ARGUMENT");
  }
  if (command === "update") {
    if (!/^\d+$/.test(options["expected-revision"])) {
      throw stateError("INVALID_EXPECTED_REVISION");
    }
    const revision = Number(options["expected-revision"]);
    if (!Number.isSafeInteger(revision)) {
      throw stateError("INVALID_EXPECTED_REVISION");
    }
    options.expectedRevision = revision;
  }
  return { command, options };
}

async function readCappedHandle(handle, maximum) {
  const buffer = Buffer.alloc(maximum + 1);
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(
      buffer,
      offset,
      buffer.length - offset,
      offset,
    );
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  if (offset > maximum) throw stateError("DOCUMENT_TOO_LARGE");
  return buffer.subarray(0, offset);
}

async function stdinBytes(io) {
  if (typeof io.readStdin === "function") {
    const bytes = await io.readStdin();
    const buffer = Buffer.isBuffer(bytes)
      ? bytes
      : Buffer.from(String(bytes), "utf8");
    if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
      throw stateError("DOCUMENT_TOO_LARGE");
    }
    return buffer;
  }
  const stream = io.stdin ?? process.stdin;
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > MAX_DOCUMENT_BYTES) {
      throw stateError("DOCUMENT_TOO_LARGE");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export async function readJsonInput(value, io = {}) {
  let bytes;
  try {
    if (value === "-") {
      bytes = await stdinBytes(io);
    } else {
      const fsOps = io.fsOps ?? fs.promises;
      const handle = await fsOps.open(value, fs.constants.O_RDONLY);
      try {
        bytes = await readCappedHandle(handle, MAX_DOCUMENT_BYTES);
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    if (error instanceof SuperifyStateError) throw error;
    throw stateError("INPUT_READ_FAILED");
  }
  bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), "utf8");
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
    throw stateError("DOCUMENT_TOO_LARGE");
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw stateError("INVALID_JSON_INPUT");
  }
}

function validLockRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify(["createdAt", "hostname", "pid"])
  )
    return false;
  if (!Number.isSafeInteger(value.pid) || value.pid <= 0) return false;
  if (typeof value.hostname !== "string" || value.hostname.length === 0)
    return false;
  if (
    typeof value.createdAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.createdAt)
  )
    return false;
  try {
    return new Date(value.createdAt).toISOString() === value.createdAt;
  } catch {
    return false;
  }
}

function verifyRecoveryLockStat(stat) {
  if (!stat || stat.isSymbolicLink() || !stat.isFile()) {
    throw stateError("UNSAFE_STATE_PATH");
  }
  if (process.platform !== "win32" && (stat.mode & 0o777) !== 0o600) {
    throw stateError("UNSAFE_LOCK_MODE");
  }
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw stateError("UNSAFE_STATE_OWNER");
  }
}

function defaultPidAlive(pid) {
  process.kill(pid, 0);
  return true;
}

export async function recoverLock({
  stateId,
  env = process.env,
  now = new Date().toISOString(),
  hostname = os.hostname(),
  pidAlive = defaultPidAlive,
  fsOps = fs.promises,
} = {}) {
  assertStateId(stateId);
  const paths = await inspectReadOnlyPaths({ stateId, env, fsOps });
  let handle;
  let opened;
  try {
    try {
      handle = await fsOps.open(
        paths.lockPath,
        fs.constants.O_RDONLY | noFollowFlag(),
      );
    } catch (error) {
      if (error?.code === "ENOENT") throw stateError("LOCK_NOT_FOUND", 2);
      if (error?.code === "ELOOP") throw stateError("SYMLINK_REJECTED");
      throw stateError("LOCK_READ_FAILED");
    }
    opened = await handle.stat();
    verifyRecoveryLockStat(opened);
    let record;
    try {
      const bytes = await readCappedHandle(handle, 4096);
      if (bytes.at(-1) !== 0x0a) {
        throw new Error("invalid lock record");
      }
      record = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, -1)),
      );
    } catch {
      throw stateError("INVALID_LOCK_RECORD");
    }
    if (!validLockRecord(record)) throw stateError("INVALID_LOCK_RECORD");
    const nowMs = Date.parse(typeof now === "function" ? now() : now);
    if (!Number.isFinite(nowMs)) throw stateError("INVALID_RECOVERY_TIME");
    if (nowMs - Date.parse(record.createdAt) < LOCK_RECOVERY_AGE_MS) {
      throw stateError("LOCK_NOT_STALE", 2);
    }
    const currentHostname =
      typeof hostname === "function" ? hostname() : hostname;
    if (record.hostname !== currentHostname) {
      throw stateError("LOCK_HOST_MISMATCH", 2);
    }
    let live;
    try {
      live = await pidAlive(record.pid);
    } catch (error) {
      if (error?.code === "EPERM") live = true;
      else if (error?.code === "ESRCH") live = false;
      else throw stateError("LOCK_PID_CHECK_FAILED");
    }
    if (live !== false) throw stateError("LOCK_PID_ALIVE", 2);
    try {
      await handle.close();
      handle = null;
    } catch {
      throw stateError("LOCK_READ_FAILED");
    }
    await assertPathAnchors(fsOps, paths.anchors);
    const current = await lstatOptional(fsOps, paths.lockPath);
    if (
      !current ||
      current.isSymbolicLink() ||
      !current.isFile() ||
      !sameInode(current, opened)
    ) {
      throw stateError("LOCK_OWNERSHIP_LOST");
    }
    verifyRecoveryLockStat(current);
    const quarantinePath = path.join(
      paths.goalDir,
      `.writer.lock.recovery.${process.pid}.${systemRandomUUID()}.quarantine`,
    );
    assertContained(paths.goalDir, quarantinePath);
    try {
      await fsOps.rename(paths.lockPath, quarantinePath);
    } catch {
      throw stateError("LOCK_RECOVERY_FAILED");
    }
    const quarantined = await lstatOptional(fsOps, quarantinePath);
    const replacement = await lstatOptional(fsOps, paths.lockPath);
    let quarantineError = null;
    try {
      verifyRecoveryLockStat(quarantined);
    } catch (error) {
      quarantineError = error;
    }
    if (quarantineError || !sameInode(quarantined, opened) || replacement) {
      if (!replacement && quarantined) {
        await fsOps.rename(quarantinePath, paths.lockPath).catch(() => {});
      }
      if (quarantineError) throw quarantineError;
      throw stateError("LOCK_OWNERSHIP_LOST");
    }
    // Portable Node has no descriptor-relative conditional unlink. Keep the
    // verified stale inode quarantined at mode 0600 rather than risk deleting
    // a same-user replacement installed after the final identity check.
    await syncDirectory(fsOps, paths.goalDir, {
      durabilityRequired: true,
      anchors: paths.anchors,
    });
    return { stateId, recovered: true };
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function cliInputError(error) {
  if (error instanceof SuperifyStateError && error.code === "UNSUPPORTED_SCHEMA") {
    return stateError("INVALID_DOCUMENT");
  }
  return error;
}

export async function runCli(argv, io = {}, deps = {}) {
  const parsed = parseArgs(argv);
  if (parsed.help) return { exitCode: 0, output: CLI_HELP };
  const { command, options } = parsed;
  const common = {
    env: deps.env ?? io.env ?? process.env,
    fsOps: deps.fsOps ?? fs.promises,
  };
  if (command === "init") {
    const input = await readJsonInput(options.input, { ...io, fsOps: common.fsOps });
    let result;
    try {
      result = await initializeState(input, {
        ...deps,
        ...common,
        stateId: options["state-id"],
      });
    } catch (error) {
      throw cliInputError(error);
    }
    const { document } = result;
    return {
      exitCode: 0,
      envelope: {
        ok: true,
        stateId: document.activation.stateId,
        path: result.progressPath,
        revision: document.revision,
        packageRevision: document.packageRevision,
        planRevision: document.planRevision,
        createdAt: document.createdAt,
      },
    };
  }
  if (command === "read" || command === "path") {
    const result = await readState({ stateId: options["state-id"], ...common });
    return {
      exitCode: 0,
      envelope:
        command === "read"
          ? {
              ok: true,
              stateId: options["state-id"],
              path: result.progressPath,
              document: result.document,
            }
          : {
              ok: true,
              stateId: options["state-id"],
              path: result.progressPath,
            },
    };
  }
  if (command === "update") {
    const candidate = await readJsonInput(options.input, {
      ...io,
      fsOps: common.fsOps,
    });
    let result;
    try {
      result = await updateState({
        stateId: options["state-id"],
        expectedRevision: options.expectedRevision,
        candidate,
        ...common,
        ...deps,
      });
    } catch (error) {
      throw cliInputError(error);
    }
    const { document } = result;
    return {
      exitCode: 0,
      envelope: {
        ok: true,
        stateId: options["state-id"],
        path: result.progressPath,
        revision: document.revision,
        packageRevision: document.packageRevision,
        planRevision: document.planRevision,
      },
    };
  }
  const result = await recoverLock({ stateId: options["state-id"], ...common, ...deps });
  return {
    exitCode: 0,
    envelope: { ok: true, stateId: result.stateId, recovered: true },
  };
}

function writeCli(stream, value) {
  stream.write(value);
}

export async function main(argv = process.argv.slice(2), io = {}, deps = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  try {
    const result = await runCli(argv, io, deps);
    writeCli(
      stdout,
      result.output ?? `${JSON.stringify(result.envelope)}\n`,
    );
    return result.exitCode;
  } catch (error) {
    const code =
      error instanceof SuperifyStateError && /^[A-Z0-9_]+$/.test(error.code)
        ? error.code
        : "OPERATION_FAILED";
    const envelope = `${JSON.stringify({ ok: false, code })}\n`;
    writeCli(stderr, Buffer.byteLength(envelope) <= 256 ? envelope : '{"ok":false,"code":"OPERATION_FAILED"}\n');
    return error instanceof SuperifyStateError ? error.exitCode : 1;
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
