#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_DOCUMENT_BYTES,
  SuperifyStateError,
  inspectStatePaths,
  resolveStatePaths,
  validateProgressDocument,
} from "./superify-state.mjs";

const LOOPBACK_HOST = "127.0.0.1";
const MAX_ASSET_BYTES = 262_144;
const SECURITY_HEADERS = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
});
const ROUTES = Object.freeze({
  "/": Object.freeze({ file: "index.html", type: "text/html; charset=utf-8" }),
  "/styles.css": Object.freeze({
    file: "styles.css",
    type: "text/css; charset=utf-8",
  }),
  "/viewer.js": Object.freeze({
    file: "viewer.js",
    type: "text/javascript; charset=utf-8",
  }),
});
const JSON_TYPE = "application/json; charset=utf-8";
const HELP = `Usage: node skills/superify/scripts/superify-viewer.mjs --state-id <uuid> [--port <0-65535>]\n\nOptions:\n  --state-id <uuid>  Select the Superify progress artifact.\n  --port <number>    Select a loopback port (default: 0).\n  --help             Show this help.\n`;
const scriptPath = fileURLToPath(import.meta.url);
const assetRoot = path.resolve(path.dirname(scriptPath), "..", "assets", "viewer");

function boundedJson(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function writeResponse(response, method, status, body, headers = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    ...headers,
    Connection: "close",
    "Content-Length": bytes.byteLength,
  });
  response.end(method === "HEAD" ? undefined : bytes);
}

function errorResponse(response, method, status, value, headers = {}) {
  writeResponse(response, method, status, boundedJson(value), {
    "Content-Type": JSON_TYPE,
    ...headers,
  });
}

function rawBadRequest(socket) {
  if (!socket.writable) return;
  const body = boundedJson({ state: "error", message: "Invalid request" });
  const headers = [
    "HTTP/1.1 400 Bad Request",
    ...Object.entries(SECURITY_HEADERS).map(([name, value]) => `${name}: ${value}`),
    `Content-Type: ${JSON_TYPE}`,
    `Content-Length: ${body.byteLength}`,
    "Connection: close",
    "",
    "",
  ].join("\r\n");
  // Parser-level failures have no trustworthy request-method boundary under
  // split or pipelined input. Keep them metadata-only for every method.
  socket.end(Buffer.from(headers, "latin1"));
}

function exactHost(request, port) {
  let hostCount = 0;
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === "host") hostCount += 1;
  }
  if (hostCount !== 1) return false;
  return (
    request.headers.host === `${LOOPBACK_HOST}:${port}` ||
    request.headers.host === `localhost:${port}`
  );
}

function exactRoute(target) {
  if (
    typeof target !== "string" ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.includes("?") ||
    target.includes("#") ||
    target.includes("\\") ||
    /%5c/i.test(target) ||
    target.includes("\0")
  ) {
    return null;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }
  if (
    decoded.includes("\0") ||
    decoded.includes("\\") ||
    decoded.split("/").includes("..") ||
    /%[0-9a-f]{2}/i.test(decoded)
  ) {
    return null;
  }
  return decoded;
}

function isMalformedTarget(target) {
  return (
    typeof target !== "string" ||
    !target.startsWith("/") ||
    target.includes("\0") ||
    target.includes("\\") ||
    /%5c/i.test(target)
  );
}

const validateViewerDocument = validateProgressDocument;

function sameFile(left, right) {
  return (
    left.isFile() &&
    right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino
  );
}

async function readCappedFile(
  filePath,
  maximum,
  { secureStateFile = false } = {},
) {
  const before = await fs.promises.lstat(filePath);
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new SuperifyStateError("UNSAFE_STATE_PATH", "State is unavailable.");
  }
  let handle;
  try {
    handle = await fs.promises.open(
      filePath,
      fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
    );
    const opened = await handle.stat();
    if (!sameFile(before, opened)) {
      throw new SuperifyStateError("UNSAFE_STATE_PATH", "State is unavailable.");
    }
    if (
      secureStateFile &&
      process.platform !== "win32" &&
      (opened.mode & 0o777) !== 0o600
    ) {
      throw new SuperifyStateError("UNSAFE_STATE_MODE", "State is unavailable.");
    }
    if (
      secureStateFile &&
      typeof process.getuid === "function" &&
      opened.uid !== process.getuid()
    ) {
      throw new SuperifyStateError("UNSAFE_STATE_OWNER", "State is unavailable.");
    }
    const buffer = Buffer.alloc(maximum + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const { bytesRead } = await handle.read(
        buffer,
        offset,
        buffer.byteLength - offset,
        offset,
      );
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maximum) {
      throw new SuperifyStateError("DOCUMENT_TOO_LARGE", "State is unavailable.");
    }
    const after = await fs.promises.lstat(filePath);
    if (!sameFile(opened, after)) {
      throw new SuperifyStateError("UNSAFE_STATE_PATH", "State is unavailable.");
    }
    if (
      secureStateFile &&
      process.platform !== "win32" &&
      (after.mode & 0o777) !== 0o600
    ) {
      throw new SuperifyStateError("UNSAFE_STATE_MODE", "State is unavailable.");
    }
    if (
      secureStateFile &&
      typeof process.getuid === "function" &&
      after.uid !== process.getuid()
    ) {
      throw new SuperifyStateError("UNSAFE_STATE_OWNER", "State is unavailable.");
    }
    return buffer.subarray(0, offset);
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function readValidatedArtifact(stateId, env) {
  const paths = await inspectStatePaths({ stateId, env });
  let bytes;
  try {
    bytes = await readCappedFile(paths.progressPath, MAX_DOCUMENT_BYTES, {
      secureStateFile: true,
    });
  } catch (error) {
    if (error instanceof SuperifyStateError) throw error;
    if (error?.code === "ENOENT") {
      throw new SuperifyStateError("STATE_NOT_FOUND", "State is unavailable.", 2);
    }
    throw new SuperifyStateError("STATE_READ_FAILED", "State is unavailable.");
  }
  try {
    if (bytes.byteLength === 0 || bytes.at(-1) !== 0x0a) throw new Error();
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(0, -1),
    );
    const document = validateViewerDocument(JSON.parse(text));
    if (document.activation.stateId !== stateId) {
      throw new SuperifyStateError("INVALID_STORED_STATE", "State is unavailable.");
    }
    await inspectStatePaths({ stateId, env });
    return {
      document,
      fingerprint: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    if (error instanceof SuperifyStateError && error.code !== "INVALID_DOCUMENT") {
      throw error;
    }
    throw new SuperifyStateError("INVALID_STORED_STATE", "State is unavailable.");
  }
}

async function productionAsset(route) {
  const descriptor = ROUTES[route];
  const bytes = await readCappedFile(path.join(assetRoot, descriptor.file), MAX_ASSET_BYTES);
  return bytes;
}

function normalizeArtifact(result, stateId) {
  if (!result || typeof result !== "object") {
    throw new SuperifyStateError("INVALID_STORED_STATE", "State is unavailable.");
  }
  const document = validateViewerDocument(result.document);
  if (document.activation.stateId !== stateId) {
    throw new SuperifyStateError("INVALID_STORED_STATE", "State is unavailable.");
  }
  if (!/^[0-9a-f]{64}$/.test(result.fingerprint ?? "")) {
    throw new SuperifyStateError("INVALID_STORED_STATE", "State is unavailable.");
  }
  return { document, fingerprint: result.fingerprint };
}

export function createViewerServer({
  stateId,
  env = process.env,
  readDocument,
  loadAsset = productionAsset,
} = {}) {
  resolveStatePaths({ stateId, env });
  const documentProvider = readDocument ?? (() => readValidatedArtifact(stateId, env));
  const malformedRequestLines = new WeakSet();
  const server = http.createServer({ requireHostHeader: false }, async (request, response) => {
    try {
      await new Promise((resolve) => setImmediate(resolve));
      if (malformedRequestLines.has(request.socket)) {
        errorResponse(response, request.method, 400, {
          state: "error",
          message: "Invalid request",
        });
        return;
      }
      const address = server.address();
      if (!address || typeof address === "string" || !exactHost(request, address.port)) {
        errorResponse(response, request.method, 400, {
          state: "error",
          message: "Invalid request",
        });
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        errorResponse(
          response,
          request.method,
          405,
          { state: "error", message: "Method not allowed" },
          { Allow: "GET, HEAD" },
        );
        return;
      }
      if (isMalformedTarget(request.url)) {
        errorResponse(response, request.method, 400, {
          state: "error",
          message: "Invalid request",
        });
        return;
      }
      const route = exactRoute(request.url);
      if (route === "/api/progress") {
        try {
          const artifact = normalizeArtifact(await documentProvider({ stateId, env }), stateId);
          writeResponse(
            response,
            request.method,
            200,
            boundedJson(artifact.document),
            {
              "Content-Type": JSON_TYPE,
              "X-Superify-Artifact-SHA256": artifact.fingerprint,
            },
          );
        } catch (error) {
          const missing =
            error instanceof SuperifyStateError &&
            (error.code === "STATE_NOT_FOUND" || error.exitCode === 2);
          errorResponse(
            response,
            request.method,
            missing ? 404 : 422,
            missing
              ? { state: "waiting", message: "Waiting for /superify" }
              : { state: "error", message: "Progress state is unavailable" },
          );
        }
        return;
      }
      const descriptor = ROUTES[route];
      if (!descriptor) {
        errorResponse(response, request.method, 404, {
          state: "error",
          message: "Not found",
        });
        return;
      }
      const asset = await loadAsset(route);
      const bytes = Buffer.isBuffer(asset) ? asset : Buffer.from(asset);
      if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error("asset too large");
      writeResponse(response, request.method, 200, bytes, {
        "Content-Type": descriptor.type,
      });
    } catch {
      if (!response.headersSent) {
        errorResponse(response, request.method, 500, {
          state: "error",
          message: "Viewer resource is unavailable",
        });
      } else {
        response.destroy();
      }
    }
  });
  server.on("connection", (socket) => {
    let prefix = Buffer.alloc(0);
    const inspectRequestLine = (chunk) => {
      if (prefix === null) return;
      const remaining = 8_192 - prefix.byteLength;
      if (remaining <= 0) {
        malformedRequestLines.add(socket);
        prefix = null;
        return;
      }
      prefix = Buffer.concat([prefix, chunk.subarray(0, remaining)]);
      const lineEnd = prefix.indexOf("\r\n");
      if (lineEnd < 0) return;
      const requestLine = prefix.subarray(0, lineEnd).toString("latin1");
      if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+ [^\s]+ HTTP\/1\.[01]$/.test(requestLine)) {
        malformedRequestLines.add(socket);
      }
      prefix = null;
      socket.removeListener("data", inspectRequestLine);
    };
    socket.prependListener("data", inspectRequestLine);
  });
  server.on("clientError", (_error, socket) => rawBadRequest(socket));
  return server;
}

export async function startViewer({
  stateId,
  port = 0,
  env = process.env,
  io = process,
} = {}) {
  const paths = resolveStatePaths({ stateId, env });
  const server = createViewerServer({ stateId, env });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: LOOPBACK_HOST, port }, resolve);
  });
  const selected = server.address();
  if (!selected || typeof selected === "string") {
    server.close();
    throw new Error("Viewer failed to select a loopback port.");
  }
  return {
    server,
    url: `http://${LOOPBACK_HOST}:${selected.port}/`,
    stateId,
    statePath: paths.progressPath,
  };
}

function parseArguments(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.includes("--help")) throw new Error("Invalid help arguments.");
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!new Set(["--state-id", "--port"]).has(flag) || value === undefined) {
      throw new Error("Invalid viewer argument.");
    }
    if (values.has(flag)) throw new Error(`Duplicate viewer argument: ${flag}`);
    values.set(flag, value);
  }
  if (!values.has("--state-id")) throw new Error("The --state-id argument is required.");
  const stateId = values.get("--state-id");
  resolveStatePaths({ stateId });
  const rawPort = values.get("--port") ?? "0";
  if (!/^\d+$/.test(rawPort)) throw new Error("Invalid viewer port.");
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("Invalid viewer port.");
  }
  return { stateId, port };
}

export async function runCli(argv, deps = {}) {
  const options = parseArguments(argv);
  if (options.help) return { exitCode: 0, output: HELP };
  const launch = deps.startViewer ?? startViewer;
  const started = await launch(options);
  return {
    exitCode: 0,
    envelope: {
      url: started.url,
      stateId: started.stateId,
      statePath: started.statePath,
    },
  };
}

async function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    const [modulePath, invokedPath] = await Promise.all([
      fs.promises.realpath(scriptPath),
      fs.promises.realpath(process.argv[1]),
    ]);
    return modulePath === invokedPath;
  } catch {
    return false;
  }
}

if (await isDirectRun()) {
  try {
    const result = await runCli(process.argv.slice(2));
    process.stdout.write(result.output ?? `${JSON.stringify(result.envelope)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({ ok: false, error: { code: "VIEWER_FAILED", summary: "Viewer could not start" } })}\n`,
    );
    process.exitCode = error?.exitCode === 2 ? 2 : 1;
  }
}
