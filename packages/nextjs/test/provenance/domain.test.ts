import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_EVIDENCE_BYTES,
  createAttestation,
  normalizeCid,
  normalizeSourceUri,
  sha256Hex,
  validateEvidenceBytes,
} from "../../lib/provenance/domain";

test("sha256Hex is deterministic for exact evidence bytes", () => {
  assert.equal(
    sha256Hex(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("evidence byte limits reject empty and oversized content", () => {
  assert.throws(() => validateEvidenceBytes(new Uint8Array()), /empty/i);
  assert.throws(() => validateEvidenceBytes(new Uint8Array(MAX_EVIDENCE_BYTES + 1)), /5 MiB/i);
});

test("source URI only accepts HTTP(S) without embedded credentials", () => {
  assert.equal(normalizeSourceUri("https://example.com/a"), "https://example.com/a");
  assert.throws(() => normalizeSourceUri("file:///etc/passwd"), /HTTP or HTTPS/i);
  assert.throws(() => normalizeSourceUri("https://user:pass@example.com/a"), /credentials/i);
});

test("CID validation is bounded and rejects path-like input", () => {
  assert.equal(normalizeCid("QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS"), "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS");
  assert.throws(() => normalizeCid("../../etc/passwd"), /CID is invalid/i);
});

test("attestations normalize metadata and enforce one-message size", () => {
  const attestation = createAttestation({
    cid: "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS",
    sha256: "A".repeat(64),
    sourceUri: "https://example.com/source",
    title: "  Example  ",
    mimeType: "text/plain",
    size: 12,
    capturedAt: "2026-09-28T00:00:00.000Z",
  });

  assert.equal(attestation.sha256, "a".repeat(64));
  assert.equal(attestation.title, "Example");
});
