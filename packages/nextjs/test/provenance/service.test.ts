import assert from "node:assert/strict";
import test from "node:test";

import { createAttestation, sha256Hex } from "../../lib/provenance/domain";
import { createProvenanceService, ProvenanceDependencies } from "../../lib/provenance/application";

const cid = "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS";

function dependencies(overrides: Partial<ProvenanceDependencies> = {}): ProvenanceDependencies {
  return {
    addEvidence: async () => cid,
    fetchEvidence: async () => Buffer.from("evidence"),
    submitAttestation: async () => ({
      topicId: "0.0.123",
      transactionId: "0.0.1@1.2",
      status: "SUCCESS",
    }),
    findAttestation: async (requestedCid, digest) => ({
      sequenceNumber: 7,
      consensusTimestamp: "1790547970.449867104",
      attestation: createAttestation({
        cid: requestedCid,
        sha256: digest,
        sourceUri: "https://example.com",
        title: "evidence.txt",
        mimeType: "text/plain",
        size: Buffer.byteLength("evidence"),
        capturedAt: "2026-09-28T00:00:00.000Z",
      }),
    }),
    now: () => new Date("2026-09-28T00:00:00.000Z"),
    topicId: () => "0.0.123",
    ...overrides,
  };
}

test("anchorEvidence hashes the exact bytes before submitting", async () => {
  const seen: { digest?: string } = {};
  const deps = dependencies({
    submitAttestation: async attestation => {
      seen.digest = attestation.sha256;
      return { topicId: "0.0.123", transactionId: "0.0.1@1.2", status: "SUCCESS" };
    },
  });
  const service = createProvenanceService(deps);
  const bytes = Buffer.from("exact bytes");

  const result = await service.anchorEvidence({ bytes, title: "evidence.txt", mimeType: "text/plain" });

  assert.equal(seen.digest, sha256Hex(bytes));
  assert.equal(result.cid, cid);
  assert.equal(result.status, "SUCCESS");
});

test("verifyEvidence verifies CID, digest and byte size", async () => {
  const service = createProvenanceService(dependencies());
  const result = await service.verifyEvidence(cid);

  assert.equal(result.verified, true);
  assert.equal(result.sequenceNumber, 7);
  assert.equal(result.sha256, sha256Hex(Buffer.from("evidence")));
});

test("verifyEvidence rejects a matching digest with the wrong attested size", async () => {
  const deps = dependencies({
    findAttestation: async (requestedCid, digest) => ({
      sequenceNumber: 8,
      consensusTimestamp: "1790547970.449867105",
      attestation: createAttestation({
        cid: requestedCid,
        sha256: digest,
        mimeType: "text/plain",
        size: 1,
        capturedAt: "2026-09-28T00:00:00.000Z",
      }),
    }),
  });
  const service = createProvenanceService(deps);

  const result = await service.verifyEvidence(cid);
  assert.equal(result.verified, false);
  assert.equal(result.attestation, null);
});
