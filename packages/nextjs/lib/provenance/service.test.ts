import { PROVENANCE_SCHEMA, type ProvenanceAttestation, sha256Hex } from "./domain";
import type { AttestationPublisher, AttestationReader, EvidenceStore, MirrorAttestation } from "./ports";
import { ProvenanceService } from "./service";
import assert from "node:assert/strict";
import test from "node:test";

const CID = "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS";
const TOPIC = "0.0.123";
const bytes = new TextEncoder().encode("provenance fixture");

function attestation(): ProvenanceAttestation {
  return {
    schema: PROVENANCE_SCHEMA,
    cid: CID,
    sha256: sha256Hex(bytes),
    sourceUri: "https://example.com",
    title: "fixture.txt",
    mimeType: "text/plain",
    size: bytes.byteLength,
    capturedAt: "2026-09-28T07:00:00.000Z",
  };
}

class MemoryStore implements EvidenceStore {
  async add(): Promise<string> {
    return CID;
  }
  async read(): Promise<Uint8Array> {
    return bytes;
  }
}

test("anchor returns the HCS sequence number needed for O(1) verification", async () => {
  const publisher: AttestationPublisher = {
    async publish(value) {
      assert.equal(value.cid, CID);
      return { transactionId: "0.0.1@1.2", status: "SUCCESS", sequenceNumber: 42 };
    },
  };
  const service = new ProvenanceService(TOPIC, new MemoryStore(), undefined, publisher);
  const result = await service.anchor({ bytes, mimeType: "text/plain" });

  assert.equal(result.sequenceNumber, 42);
  assert.equal(result.topicId, TOPIC);
});

test("verify uses direct sequence lookup when the caller has the sequence number", async () => {
  let directCalls = 0;
  let scanCalls = 0;
  const mirror: MirrorAttestation = {
    attestation: attestation(),
    sequenceNumber: 42,
    consensusTimestamp: "1790000000.000000001",
  };
  const reader: AttestationReader = {
    async getBySequence(sequenceNumber) {
      directCalls += 1;
      assert.equal(sequenceNumber, 42);
      return mirror;
    },
    async findMatching() {
      scanCalls += 1;
      return mirror;
    },
  };

  const result = await new ProvenanceService(TOPIC, new MemoryStore(), reader).verify(CID, 42);
  assert.equal(result.verified, true);
  assert.equal(directCalls, 1);
  assert.equal(scanCalls, 0);
});

test("verify falls back to bounded topic search for legacy callers without a sequence number", async () => {
  let scanCalls = 0;
  const reader: AttestationReader = {
    async getBySequence() {
      throw new Error("unexpected direct lookup");
    },
    async findMatching(cid, digest) {
      scanCalls += 1;
      assert.equal(cid, CID);
      assert.equal(digest, sha256Hex(bytes));
      return {
        attestation: attestation(),
        sequenceNumber: 7,
        consensusTimestamp: "1790000000.000000007",
      };
    },
  };

  const result = await new ProvenanceService(TOPIC, new MemoryStore(), reader).verify(CID);
  assert.equal(result.verified, true);
  assert.equal(scanCalls, 1);
});
