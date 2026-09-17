export const VIEW_CAPS = Object.freeze({
  milestones: 5,
  tasks: 5,
  proof: 4,
  activity: 4,
  health: 4,
});

const STATUS = Object.freeze({
  active: ["●", "Active"],
  blocked: ["!", "Blocked"],
  complete: ["✓", "Complete"],
  completed: ["✓", "Completed"],
  conflict: ["!", "Conflict"],
  error: ["!", "Error"],
  failed: ["×", "Failed"],
  in_progress: ["↻", "In progress"],
  open: ["!", "Open"],
  passed: ["✓", "Passed"],
  pending: ["○", "Pending"],
  planned: ["○", "Planned"],
  ready: ["●", "Ready"],
  resolved: ["✓", "Resolved"],
  skipped: ["–", "Skipped"],
  stale: ["!", "Stale"],
  synced: ["✓", "Synced"],
  unavailable: ["–", "Unavailable"],
  waiting: ["○", "Waiting"],
  watch: ["!", "Watch"],
});

function statusDisplay(value, fallback = "Unknown") {
  const pair = STATUS[value] ?? ["•", fallback];
  return { icon: pair[0], label: pair[1] };
}

function bounded(items, cap, extra = {}) {
  const selected = items.slice(0, cap);
  return {
    items: selected,
    visible: selected.length,
    total: items.length,
    omitted: Math.max(0, items.length - selected.length),
    ...extra,
  };
}

function openBlocking(document) {
  return document.blockers.filter(
    (item) => item.status === "open" && item.severity === "blocking",
  );
}

function verificationPassed(document, step) {
  return step.status === "completed" && step.verificationIds
    .map((id) => document.verification.find((item) => item.id === id))
    .filter((item) => item?.required)
    .every((item) => item.status === "passed" || (
      item.status === "skipped" && document.decisions.some(
        (decision) => decision.id === item.approvalDecisionId &&
          decision.approvalRequired === true && decision.status === "resolved",
      )
    ));
}

function normalizedMilestones(document) {
  const blockers = openBlocking(document);
  return document.milestones.map((milestone) => {
    const steps = document.steps.filter((step) => step.milestoneId === milestone.id);
    const blocked = blockers.some(
      (blocker) => blocker.milestoneId === milestone.id ||
        steps.some((step) => step.id === blocker.stepId),
    );
    let status = "pending";
    if (steps.length > 0 && steps.every((step) => verificationPassed(document, step))) {
      status = "completed";
    } else if (blocked) {
      status = "blocked";
    } else if (steps.some((step) => ["in_progress", "completed"].includes(step.status))) {
      status = "in_progress";
    }
    return { ...milestone, status };
  });
}

export function selectMilestoneWindow(milestones) {
  const cap = VIEW_CAPS.milestones;
  if (milestones.length <= cap) return bounded(milestones, cap);
  const activeIndex = milestones.findIndex((item) => ["in_progress", "blocked"].includes(item.status));
  const center = activeIndex < 0 ? 0 : activeIndex;
  const start = Math.max(0, Math.min(milestones.length - cap, center - Math.floor(cap / 2)));
  return bounded(milestones.slice(start, start + cap), cap, {
    total: milestones.length,
    omitted: milestones.length - cap,
  });
}

function activeMilestoneId(document) {
  const normalized = normalizedMilestones(document);
  return normalized.find((item) => ["in_progress", "blocked"].includes(item.status))?.id ??
    normalized.find((item) => item.status === "pending")?.id ?? null;
}

export function selectTaskRows(document) {
  const milestoneId = activeMilestoneId(document);
  const seen = new Set();
  const tasks = document.steps.filter((step) => {
    if (step.milestoneId !== milestoneId || seen.has(step.id)) return false;
    seen.add(step.id);
    return true;
  });
  const blockingIds = new Set(openBlocking(document).map((item) => item.stepId).filter(Boolean));
  const completed = tasks
    .filter((item) => item.status === "completed")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const latestCompletedId = completed[0]?.id ?? null;
  const rank = (item) => {
    if (item.status === "in_progress") return 0;
    if (blockingIds.has(item.id) || item.status === "blocked") return 1;
    if (item.id === latestCompletedId) return 2;
    if (item.status === "pending") return 3;
    if (item.status === "completed") return 4;
    return 5;
  };
  const ordered = tasks
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => ({
      ...item,
      statusDisplay: statusDisplay(
        blockingIds.has(item.id) ? "blocked" : item.status,
        item.status,
      ),
    }));
  return bounded(ordered, VIEW_CAPS.tasks, {
    emptyLabel: ordered.length ? null : "No tasks yet",
  });
}

function currentFocus(document) {
  let focus = document.steps.find((step) => step.status === "in_progress");
  const blockers = openBlocking(document);
  if (!focus && blockers[0]) {
    focus = document.steps.find((step) => step.id === blockers[0].stepId) ??
      document.milestones.find((item) => item.id === blockers[0].milestoneId);
  }
  return focus ?? document.steps.find(
    (step) => step.status === "pending" && !blockers.some(
      (blocker) => blocker.stepId === step.id || blocker.milestoneId === step.milestoneId,
    ),
  ) ?? null;
}

function presentationFor(document, stale) {
  if (["error", "conflict"].includes(document.state) ||
      document.activation?.status === "conflict") return "error";
  if (["draft", "unsupported"].includes(document.state) ||
      ["awaiting_approval", "approved", "not_started", "unsupported"].includes(document.activation?.status) ||
      !document.goal) return "waiting";
  if (stale) return "stale";
  return "ready";
}

function telemetryValue(value, unit) {
  if (!value || value.availability === "unavailable") {
    return { value: null, label: "Not reported", statusDisplay: statusDisplay("unavailable") };
  }
  return {
    value: value.value,
    label: unit === "ms" ? `${Math.round(value.value / 1000)}s` : String(value.value),
    statusDisplay: statusDisplay("ready"),
  };
}

export function buildViewModel(document, nowMs = Date.now()) {
  const milestones = normalizedMilestones(document);
  const verified = document.steps.filter((step) => verificationPassed(document, step)).length;
  const total = document.steps.length;
  const elapsedMs = Math.max(0, nowMs - Date.parse(document.updatedAt));
  const stale = elapsedMs > document.staleAfterMs;
  const blockers = openBlocking(document);
  const watch = document.blockers.filter(
    (item) => item.status === "open" && item.severity === "watch",
  );
  const openDecisions = document.decisions.filter((item) => item.status === "open");
  const healthSummary = {
    blocking: blockers.length,
    watch: watch.length,
    openDecisions: openDecisions.length,
    projection: document.planProjection.status,
  };
  const healthItems = [
    { id: "blocking", label: "Blocking issues", value: blockers.length, status: blockers.length ? "blocked" : "ready" },
    { id: "watch", label: "Watch items", value: watch.length, status: watch.length ? "watch" : "ready" },
    { id: "decisions", label: "Open decisions", value: openDecisions.length, status: openDecisions.length ? "open" : "ready" },
    { id: "projection", label: "Plan projection", value: document.planProjection.status, status: document.planProjection.status },
  ].map((item) => ({ ...item, statusDisplay: statusDisplay(item.status, item.status) }));
  const proofItems = document.verification.map((item) => ({
    ...item,
    statusDisplay: statusDisplay(item.status, item.status),
  }));
  const activityItems = [...document.activity]
    .sort((a, b) => b.seq - a.seq)
    .map((item) => ({ ...item, statusDisplay: statusDisplay("ready") }));
  const milestoneWindow = selectMilestoneWindow(milestones.map((item) => ({
    ...item,
    statusDisplay: statusDisplay(item.status, item.status),
  })));
  const goalStatus = document.goal?.status ?? "waiting";
  const progress = {
    verified,
    total,
    percent: total ? Math.round((verified / total) * 100) : null,
    derived: true,
  };
  return {
    revision: document.revision,
    presentation: presentationFor(document, stale),
    goal: {
      ...(document.goal ?? { title: document.package?.outcome ?? "Goal not active" }),
      blocked: goalStatus === "blocked" || document.state === "blocked",
      status: statusDisplay(goalStatus, goalStatus),
    },
    progress,
    progressLabel: total ? `${verified}/${total} verified · derived` : "No tasks yet",
    focus: currentFocus(document),
    milestones: { ...milestoneWindow, all: milestones },
    tasks: selectTaskRows(document),
    proof: bounded(proofItems, VIEW_CAPS.proof),
    activity: bounded(activityItems, VIEW_CAPS.activity),
    health: { ...bounded(healthItems, VIEW_CAPS.health), summary: healthSummary },
    freshness: {
      stale,
      elapsedMs,
      staleAfterMs: document.staleAfterMs,
      updatedAt: document.updatedAt,
      status: statusDisplay(stale ? "stale" : "ready"),
    },
    telemetry: {
      tokens: telemetryValue(document.telemetry.tokens, "tokens"),
      elapsed: telemetryValue(document.telemetry.elapsedMs, "ms"),
    },
    links: document.links.map((item) => ({ ...item, href: safeHttpsHref(item.href) })),
    error: document.error,
  };
}

function emptyModel(presentation) {
  return {
    presentation,
    goal: { title: presentation === "waiting" ? "Waiting for progress" : "Progress unavailable", status: statusDisplay(presentation) },
  };
}

function safeRefreshMessage(result) {
  if (result.kind === "missing") return "Progress artifact is not available";
  return "Invalid progress artifact";
}

function retainSnapshot(previous, nowMs, refreshError = previous.refreshError) {
  return {
    ...previous,
    documentRevision: previous.document.revision,
    model: buildViewModel(previous.document, nowMs),
    refreshError,
  };
}

export function acceptRefresh(previous, result, nowMs = Date.now()) {
  if (result.kind !== "valid") {
    const message = safeRefreshMessage(result);
    if (previous?.document) return retainSnapshot(previous, nowMs, message);
    return {
      document: null,
      documentRevision: null,
      fingerprint: null,
      model: emptyModel(result.kind === "missing" ? "waiting" : "error"),
      refreshError: message,
    };
  }
  if (!/^[a-f0-9]{64}$/.test(result.fingerprint)) throw new Error("Invalid progress fingerprint");
  const incoming = result.document;
  if (previous?.document) {
    if (incoming.revision < previous.document.revision) {
      return retainSnapshot(previous, nowMs);
    }
    if (incoming.revision === previous.document.revision) {
      if (result.fingerprint !== previous.fingerprint) {
        return retainSnapshot(
          previous,
          nowMs,
          "Progress integrity conflict at the current revision",
        );
      }
      return retainSnapshot(previous, nowMs, null);
    }
  }
  return {
    document: incoming,
    documentRevision: incoming.revision,
    fingerprint: result.fingerprint,
    model: buildViewModel(incoming, nowMs),
    refreshError: null,
  };
}

export function safeHttpsHref(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function createSafeLinkNode(documentLike, link) {
  const label = typeof link?.label === "string" ? link.label : "Artifact";
  const href = safeHttpsHref(link?.href);
  if (!href) {
    const textOnly = documentLike.createElement("span");
    textOnly.textContent = label;
    return textOnly;
  }
  const anchor = documentLike.createElement("a");
  anchor.textContent = label;
  anchor.setAttribute("href", href);
  anchor.setAttribute("target", "_blank");
  anchor.setAttribute("rel", "noopener noreferrer");
  if (typeof link.id === "string") anchor.id = `artifact-link-${link.id}`;
  return anchor;
}

function node(documentLike, tagName, className, textValue) {
  const element = documentLike.createElement(tagName);
  if (className) element.className = className;
  if (textValue !== undefined) element.textContent = String(textValue);
  return element;
}

function markEssential(element, kind) {
  element.setAttribute("data-essential", "");
  if (kind) element.setAttribute(kind, "");
  return element;
}

function renderStatus(element, display) {
  const documentLike = element.ownerDocument ?? globalThis.document;
  const icon = node(documentLike, "span", "status-icon", display.icon);
  icon.setAttribute("aria-hidden", "true");
  const label = markEssential(
    node(documentLike, "span", "status-copy", display.label),
    "data-status-label",
  );
  element.replaceChildren(icon, label);
}

function setText(documentLike, id, value) {
  const element = documentLike.getElementById(id);
  if (element) element.textContent = String(value);
}

function renderMilestones(documentLike, region) {
  const list = documentLike.getElementById("milestone-list");
  const rows = region.items.map((item) => {
    const row = node(documentLike, "li");
    const title = markEssential(node(documentLike, "strong", "milestone-title", item.title));
    const meta = node(documentLike, "span", "milestone-meta");
    const status = markEssential(node(documentLike, "span", "milestone-state"));
    renderStatus(status, item.statusDisplay);
    const count = node(documentLike, "span", "milestone-tasks", `${item.stepIds.length} tasks`);
    meta.append(status, count);
    row.append(title, meta);
    return row;
  });
  if (!rows.length) rows.push(node(documentLike, "li", "empty-row", "No milestones yet"));
  list.replaceChildren(...rows);
  const suffix = region.omitted ? ` · ${region.omitted} hidden` : "";
  setText(documentLike, "milestones-count", `${region.visible} / ${region.total}${suffix}`);
}

function renderTasks(documentLike, region) {
  const list = documentLike.getElementById("task-list");
  const rows = region.items.map((item) => {
    const row = node(documentLike, "li", "task-row");
    const icon = node(documentLike, "span", "task-icon", item.statusDisplay.icon);
    icon.setAttribute("aria-hidden", "true");
    const label = markEssential(
      node(documentLike, "span", "task-label", item.title),
      "data-task-label",
    );
    const state = markEssential(
      node(documentLike, "span", "task-state", item.statusDisplay.label),
      "data-status-label",
    );
    row.append(icon, label, state);
    return row;
  });
  if (!rows.length) rows.push(node(documentLike, "li", "empty-row", region.emptyLabel));
  list.replaceChildren(...rows);
  const suffix = region.omitted ? ` · ${region.omitted} hidden` : "";
  setText(documentLike, "tasks-count", `${region.visible} / ${region.total}${suffix}`);
}

function evidenceRow(documentLike, item, label) {
  const row = node(documentLike, "li", "evidence-row");
  const icon = node(documentLike, "span", "evidence-icon", item.statusDisplay.icon);
  icon.setAttribute("aria-hidden", "true");
  const copy = markEssential(node(documentLike, "span", "evidence-copy"));
  const strong = markEssential(
    node(documentLike, "strong", "", item.statusDisplay.label),
    "data-status-label",
  );
  copy.append(strong, documentLike.createTextNode(` · ${label}`));
  row.append(icon, copy);
  return row;
}

function renderEvidence(documentLike, model) {
  const definitions = [
    ["proof", model.proof, (item) => item.label],
    ["activity", model.activity, (item) => item.label],
    ["health", model.health, (item) => `${item.label}: ${item.value}`],
  ];
  for (const [name, region, label] of definitions) {
    const list = documentLike.getElementById(`${name}-list`);
    const rows = region.items.map((item) => evidenceRow(documentLike, item, label(item)));
    if (!rows.length) rows.push(node(documentLike, "li", "empty-row", `No ${name} yet`));
    list.replaceChildren(...rows);
    const suffix = region.omitted ? ` · +${region.omitted}` : "";
    setText(documentLike, `${name}-count`, `${region.visible} / ${region.total}${suffix}`);
  }

  const linksRoot = documentLike.getElementById("proof-links");
  const links = model.links.slice(0, 3).map((link) => createSafeLinkNode(documentLike, link));
  if (model.links.length > links.length) {
    links.push(node(documentLike, "span", "omitted", `+${model.links.length - links.length} links`));
  }
  linksRoot.replaceChildren(...links);
}

function freshnessLabel(freshness) {
  const minutes = Math.floor(freshness.elapsedMs / 60000);
  return `${freshness.status.label} · ${minutes < 1 ? "just now" : `${minutes}m ago`}`;
}

function renderSnapshot(documentLike, snapshot) {
  const { model } = snapshot;
  const focusedId = documentLike.activeElement?.id || null;
  documentLike.documentElement.dataset.revision = String(snapshot.documentRevision);
  setText(documentLike, "goal-title", model.goal.title);
  setText(documentLike, "goal-objective", model.goal.objective ?? "Compiled package awaiting activation.");
  renderStatus(documentLike.getElementById("goal-status"), model.goal.status);
  setText(documentLike, "verified-metric", `${model.progress.verified} / ${model.progress.total}`);
  setText(documentLike, "percent-metric", model.progress.percent === null ? "—" : `${model.progress.percent}%`);
  setText(documentLike, "milestone-metric", model.milestones.total);
  const progress = documentLike.getElementById("goal-progress");
  progress.value = model.progress.percent ?? 0;
  progress.setAttribute("aria-valuetext", model.progressLabel);
  renderMilestones(documentLike, model.milestones);
  renderTasks(documentLike, model.tasks);
  renderEvidence(documentLike, model);
  setText(documentLike, "focus-value", model.focus?.title ?? "No current focus");
  setText(documentLike, "tokens-value", model.telemetry.tokens.label);
  setText(documentLike, "elapsed-value", model.telemetry.elapsed.label);
  renderLiveStatus(documentLike, snapshot);
  if (focusedId) documentLike.getElementById(focusedId)?.focus();
}

function renderEmptySnapshot(documentLike, snapshot) {
  const waiting = snapshot.model.presentation === "waiting";
  delete documentLike.documentElement.dataset.revision;
  setText(documentLike, "goal-title", snapshot.model.goal.title);
  setText(
    documentLike,
    "goal-objective",
    waiting ? "Waiting for /superify." : "Progress state is unavailable.",
  );
  renderStatus(documentLike.getElementById("goal-status"), snapshot.model.goal.status);
  setText(documentLike, "verified-metric", "—");
  setText(documentLike, "percent-metric", "—");
  setText(documentLike, "milestone-metric", "—");
  documentLike.getElementById("goal-progress").value = 0;
  renderLiveStatus(documentLike, snapshot);
}

function renderLiveStatus(documentLike, snapshot) {
  const refresh = documentLike.getElementById("refresh-status");
  if (!snapshot.document) {
    renderStatus(refresh, snapshot.model.goal.status);
    documentLike.body.dataset.presentation = snapshot.model.presentation;
    return;
  }
  const { model } = snapshot;
  const freshness = documentLike.getElementById("freshness-value");
  freshness.textContent = freshnessLabel(model.freshness);
  freshness.setAttribute("datetime", model.freshness.updatedAt);
  if (snapshot.refreshError) {
    renderStatus(refresh, { icon: "!", label: snapshot.refreshError });
  } else {
    renderStatus(refresh, model.freshness.status);
  }
  documentLike.body.dataset.presentation = snapshot.model.presentation;
}

async function readProgress(fetchLike, signal) {
  try {
    const response = await fetchLike("/api/progress", { cache: "no-store", signal });
    if (!response.ok) {
      return {
        kind: response.status === 404 ? "missing" : "invalid",
        message: "Progress artifact is unavailable",
      };
    }
    return {
      kind: "valid",
      document: await response.json(),
      fingerprint: response.headers.get("X-Superify-Artifact-SHA256"),
    };
  } catch (error) {
    if (error?.name === "AbortError") return { kind: "missing", message: "Stopped" };
    return { kind: "invalid", message: "Progress refresh failed" };
  }
}

export function startPolling(documentLike, fetchLike = globalThis.fetch) {
  const controller = new AbortController();
  let stopped = false;
  let snapshot = null;
  let renderedArtifactKey = null;
  let renderedEmptyKey = null;

  const poll = async () => {
    if (stopped) return;
    const result = await readProgress(fetchLike, controller.signal);
    if (stopped) return;
    try {
      snapshot = acceptRefresh(snapshot, result, Date.now());
    } catch {
      snapshot = acceptRefresh(
        snapshot,
        { kind: "invalid", message: "Progress refresh failed" },
        Date.now(),
      );
    }
    if (snapshot.document) {
      const artifactKey = `${snapshot.documentRevision}:${snapshot.fingerprint}`;
      if (artifactKey !== renderedArtifactKey) {
        renderSnapshot(documentLike, snapshot);
        renderedArtifactKey = artifactKey;
        renderedEmptyKey = null;
      } else {
        renderLiveStatus(documentLike, snapshot);
      }
    } else {
      const emptyKey = `${snapshot.model.presentation}:${snapshot.refreshError}`;
      if (emptyKey !== renderedEmptyKey) {
        renderEmptySnapshot(documentLike, snapshot);
        renderedEmptyKey = emptyKey;
      } else {
        renderLiveStatus(documentLike, snapshot);
      }
    }
    if (!stopped) globalThis.setTimeout(poll, 2500);
  };

  void poll();
  return () => {
    stopped = true;
    controller.abort();
  };
}

if (typeof document !== "undefined") {
  startPolling(document);
}
