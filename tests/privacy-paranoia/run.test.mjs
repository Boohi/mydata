import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, validateRegistry, isSandboxAvailable } from "./run.mjs";

test("loadRegistry parses binaries.json", async () => {
  const reg = await loadRegistry();
  assert.equal(reg.version, 1);
  assert.ok(Array.isArray(reg.binaries));
});

test("validateRegistry rejects unknown version", () => {
  assert.throws(() => validateRegistry({ version: 99, binaries: [] }), /version/);
});

test("validateRegistry rejects non-array binaries", () => {
  assert.throws(() => validateRegistry({ version: 1, binaries: "nope" }), /binaries/);
});

test("validateRegistry accepts empty list", () => {
  assert.doesNotThrow(() => validateRegistry({ version: 1, binaries: [] }));
});

test("isSandboxAvailable returns boolean", () => {
  assert.equal(typeof isSandboxAvailable(), "boolean");
});
