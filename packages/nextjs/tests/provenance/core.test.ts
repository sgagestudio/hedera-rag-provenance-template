import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_EVIDENCE_BYTES,
  normalizeCid,
  normalizeMimeType,
  normalizeSourceUri,
  normalizeTitle,
  parseAttestation,
  PROVENANCE_SCHEMA,
  ProvenanceInputError,
  sha256Hex,
  validateEvidenceBytes,
} from "../../lib/provenance/core";

test("hashing and evidence limits remain deterministic", () => {
  const bytes = new TextEncoder().encode("abc");
  assert.equal(
    sha256Hex(bytes),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  validateEvidenceBytes(bytes);
  assert.throws(() => validateEvidenceBytes(new Uint8Array()), ProvenanceInputError);
  assert.throws(() => validateEvidenceBytes(new Uint8Array(MAX_EVIDENCE_BYTES + 1)), ProvenanceInputError);
});

test("metadata and cid validation reject unsafe or unbounded input", () => {
  assert.equal(normalizeSourceUri(" https://example.com/a "), "https://example.com/a");
  assert.equal(normalizeTitle("  source.pdf  "), "source.pdf");
  assert.equal(normalizeMimeType(""), "application/octet-stream");
  assert.equal(normalizeCid("QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS"), "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS");
  assert.throws(() => normalizeCid("../etc/passwd"), ProvenanceInputError);
  assert.throws(() => normalizeTitle("bad\u0000title"), ProvenanceInputError);
});

test("attestation parser accepts only the schema we can verify", () => {
  const valid = {
    schema: PROVENANCE_SCHEMA,
    cid: "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS",
    sha256: "a".repeat(64),
    sourceUri: "https://example.com",
    title: "example",
    mimeType: "text/plain",
    size: 42,
    capturedAt: "2026-09-29T00:00:00.000Z",
  };
  assert.deepEqual(parseAttestation(valid), valid);
  assert.equal(parseAttestation({ ...valid, schema: "other" }), null);
  assert.equal(parseAttestation({ ...valid, sha256: "not-a-digest" }), null);
  assert.equal(parseAttestation({ ...valid, size: -1 }), null);
});
