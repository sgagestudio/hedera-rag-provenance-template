import assert from "node:assert/strict";
import test from "node:test";

import { assertRequestSize, assertWriteAccess, ProvenanceApiError, publicApiError } from "../../lib/provenance/api";

test("write endpoint rejects cross-origin requests before any external call", () => {
  const request = new Request("https://app.example/api/provenance", {
    method: "POST",
    headers: { origin: "https://evil.example" },
  });
  assert.throws(() => assertWriteAccess(request, { production: false }), ProvenanceApiError);
});

test("production writes fail closed and bearer comparison is enforced", () => {
  const request = new Request("https://app.example/api/provenance", { method: "POST" });
  assert.throws(() => assertWriteAccess(request, { production: true }), /disabled/);

  const rejected = new Request("https://app.example/api/provenance", {
    method: "POST",
    headers: { authorization: "Bearer wrong" },
  });
  assert.throws(() => assertWriteAccess(rejected, { production: true, token: "correct" }), /Authentication/);

  const accepted = new Request("https://app.example/api/provenance", {
    method: "POST",
    headers: { authorization: "Bearer correct" },
  });
  assert.doesNotThrow(() => assertWriteAccess(accepted, { production: true, token: "correct" }));
});

test("request size is rejected before multipart parsing", () => {
  const request = new Request("https://app.example/api/provenance", {
    method: "POST",
    headers: { "content-length": String(6 * 1024 * 1024) },
  });
  assert.throws(() => assertRequestSize(request), /upload limit/);
});

test("unexpected internal errors are not reflected to clients", () => {
  const error = publicApiError(new Error("HEDERA_OPERATOR_KEY=this-must-not-leak"), "Unable to anchor evidence.");
  assert.deepEqual(error, { status: 500, message: "Unable to anchor evidence." });
});
