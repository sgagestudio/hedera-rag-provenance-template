import assert from "node:assert/strict";
import test from "node:test";
import { PROVENANCE_SCHEMA } from "../domain";
import { UpstreamError } from "../errors";
import { HederaMirrorNodeReader } from "./mirror-node";

const CID = "QmQhxnPAcRweXUnoX2bNo54mR96CcNqLufcHnY5nsAZNKS";
const DIGEST = "a".repeat(64);
const TOPIC = "0.0.123";

function encodedMessage(cid = CID, digest = DIGEST): string {
  return Buffer.from(
    JSON.stringify({
      schema: PROVENANCE_SCHEMA,
      cid,
      sha256: digest,
      sourceUri: null,
      title: "fixture",
      mimeType: "text/plain",
      size: 12,
      capturedAt: "2026-09-28T07:00:00.000Z",
    }),
  ).toString("base64");
}

test("getBySequence uses the Mirror Node O(1) endpoint", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return Response.json({
      messages: [
        {
          consensus_timestamp: "1790000000.000000042",
          message: encodedMessage(),
          sequence_number: 42,
        },
      ],
      links: { next: null },
    });
  }) as typeof fetch;

  const reader = new HederaMirrorNodeReader("https://mirror.example", 1_000, 3, TOPIC, fetcher);
  const result = await reader.getBySequence(42);

  assert.equal(result?.sequenceNumber, 42);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/topics\/0.0.123\/messages\/42$/);
});

test("findMatching follows only same-origin pagination and stops on a match", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    if (calls.length === 1) {
      return Response.json({
        messages: [],
        links: { next: "/api/v1/topics/0.0.123/messages?limit=100&order=desc&timestamp=lt:2" },
      });
    }
    return Response.json({
      messages: [
        {
          consensus_timestamp: "1790000000.000000002",
          message: encodedMessage(),
          sequence_number: 2,
        },
      ],
      links: { next: null },
    });
  }) as typeof fetch;

  const reader = new HederaMirrorNodeReader("https://mirror.example", 1_000, 3, TOPIC, fetcher);
  const result = await reader.findMatching(CID, DIGEST);

  assert.equal(result?.sequenceNumber, 2);
  assert.equal(calls.length, 2);
});

test("findMatching rejects pagination redirects to another origin", async () => {
  const fetcher = (async () =>
    Response.json({
      messages: [],
      links: { next: "https://attacker.example/steal" },
    })) as typeof fetch;

  const reader = new HederaMirrorNodeReader("https://mirror.example", 1_000, 3, TOPIC, fetcher);
  await assert.rejects(() => reader.findMatching(CID, DIGEST), UpstreamError);
});
