import assert from "node:assert/strict";
import test from "node:test";

import type { ProvenanceConfig } from "../../lib/provenance/config";
import { PROVENANCE_SCHEMA } from "../../lib/provenance/core";
import { findMirrorAttestation } from "../../lib/provenance/mirror";

const config: ProvenanceConfig = {
  topicId: "0.0.123",
  ipfsApiUrl: "http://127.0.0.1:5001/api/v0",
  ipfsGatewayUrl: "http://127.0.0.1:8080",
  mirrorNodeUrl: "https://mirror.example",
  externalTimeoutMs: 1000,
  mirrorMaxPages: 3,
};

const cid = "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS";
const digest = "a".repeat(64);
const attestation = {
  schema: PROVENANCE_SCHEMA,
  cid,
  sha256: digest,
  sourceUri: null,
  title: "proof",
  mimeType: "text/plain",
  size: 4,
  capturedAt: "2026-09-29T00:00:00.000Z",
};

function mirrorMessage(sequence: number, body = attestation) {
  return {
    consensus_timestamp: "1790547970.449867104",
    sequence_number: sequence,
    message: Buffer.from(JSON.stringify(body)).toString("base64"),
  };
}

test("sequence lookup avoids scanning topic history", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async input => {
    calls += 1;
    assert.match(String(input), /messages\/7$/);
    return Response.json(mirrorMessage(7));
  };

  try {
    const result = await findMirrorAttestation(config, cid, digest, 4, 7);
    assert.equal(result?.sequenceNumber, 7);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("history lookup follows same-origin pagination and finds older attestations", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return Response.json({
        messages: [mirrorMessage(9, { ...attestation, cid: "Qm11111111111111111111111111111111111111111111" })],
        links: { next: "/api/v1/topics/0.0.123/messages?limit=100&order=desc&sequencenumber=lt:9" },
      });
    }
    return Response.json({ messages: [mirrorMessage(7)], links: { next: null } });
  };

  try {
    const result = await findMirrorAttestation(config, cid, digest, 4);
    assert.equal(result?.sequenceNumber, 7);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("pagination cannot redirect verification to another origin", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ messages: [], links: { next: "https://evil.example/steal" } });

  try {
    await assert.rejects(() => findMirrorAttestation(config, cid, digest, 4), /unsafe pagination link/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
