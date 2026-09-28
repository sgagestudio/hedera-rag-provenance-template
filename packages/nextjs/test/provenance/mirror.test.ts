import assert from "node:assert/strict";
import test from "node:test";

import { PROVENANCE_SCHEMA } from "../../lib/provenance/domain";
import { findMirrorAttestation } from "../../lib/provenance/mirror";

const cid = "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS";
const digest = "a".repeat(64);

test("Mirror lookup follows trusted pagination and finds older attestations", async () => {
  const previousFetch = globalThis.fetch;
  const previousTopic = process.env.HEDERA_TOPIC_ID;
  const previousPages = process.env.PROVENANCE_MIRROR_MAX_PAGES;

  process.env.HEDERA_TOPIC_ID = "0.0.123";
  process.env.PROVENANCE_MIRROR_MAX_PAGES = "2";

  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(
        JSON.stringify({
          messages: [],
          links: { next: "/api/v1/topics/0.0.123/messages?limit=100&order=desc&sequencenumber=lt:10" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const attestation = {
      schema: PROVENANCE_SCHEMA,
      cid,
      sha256: digest,
      sourceUri: "https://example.com/source",
      title: "source.txt",
      mimeType: "text/plain",
      size: 8,
      capturedAt: "2026-09-28T00:00:00.000Z",
    };

    return new Response(
      JSON.stringify({
        messages: [
          {
            consensus_timestamp: "1790547970.449867104",
            message: Buffer.from(JSON.stringify(attestation)).toString("base64"),
            sequence_number: 7,
          },
        ],
        links: { next: null },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  try {
    const result = await findMirrorAttestation(cid, digest);
    assert.equal(calls, 2);
    assert.equal(result?.sequenceNumber, 7);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousTopic === undefined) delete process.env.HEDERA_TOPIC_ID;
    else process.env.HEDERA_TOPIC_ID = previousTopic;
    if (previousPages === undefined) delete process.env.PROVENANCE_MIRROR_MAX_PAGES;
    else process.env.PROVENANCE_MIRROR_MAX_PAGES = previousPages;
  }
});
