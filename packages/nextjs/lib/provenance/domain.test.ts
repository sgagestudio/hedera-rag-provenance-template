import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TITLE_LENGTH,
  PROVENANCE_SCHEMA,
  canonicalizeCid,
  normalizeMimeType,
  normalizeTitle,
  parseProvenanceAttestation,
} from "./domain";
import { ValidationError } from "./errors";

const CID = "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS";

test("canonicalizeCid accepts the committed proof CID and rejects malformed values", () => {
  assert.equal(canonicalizeCid(CID), CID);
  assert.throws(() => canonicalizeCid("../../etc/passwd"), ValidationError);
});

test("metadata validation bounds user-controlled HCS fields", () => {
  assert.equal(normalizeTitle("  evidence.pdf  "), "evidence.pdf");
  assert.equal(normalizeMimeType("text/plain"), "text/plain");
  assert.throws(() => normalizeTitle("x".repeat(MAX_TITLE_LENGTH + 1)), ValidationError);
  assert.throws(() => normalizeTitle("bad\nname"), ValidationError);
  assert.throws(() => normalizeMimeType("not-a-mime"), ValidationError);
});

test("parseProvenanceAttestation rejects malformed public messages", () => {
  const valid = {
    schema: PROVENANCE_SCHEMA,
    cid: CID,
    sha256: "a".repeat(64),
    sourceUri: "https://example.com/source",
    title: "source.txt",
    mimeType: "text/plain",
    size: 12,
    capturedAt: "2026-09-28T07:00:00.000Z",
  };

  assert.deepEqual(parseProvenanceAttestation(valid), valid);
  assert.throws(() => parseProvenanceAttestation({ ...valid, sha256: "oops" }), ValidationError);
  assert.throws(() => parseProvenanceAttestation({ ...valid, size: Number.MAX_SAFE_INTEGER }), ValidationError);
});
