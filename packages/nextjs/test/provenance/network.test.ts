import { readBytesWithLimit, trustedNextUrl } from "../../lib/provenance/network";
import assert from "node:assert/strict";
import test from "node:test";

test("readBytesWithLimit rejects a streamed response that exceeds the cap", async () => {
  const response = new Response(Buffer.from("123456"));
  await assert.rejects(() => readBytesWithLimit(response, 5), /exceeds/i);
});

test("trustedNextUrl accepts same-origin Mirror pagination", () => {
  assert.equal(
    trustedNextUrl("https://testnet.mirrornode.hedera.com", "/api/v1/topics/0.0.1/messages?limit=100"),
    "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.1/messages?limit=100",
  );
});

test("trustedNextUrl rejects cross-origin pagination", () => {
  assert.throws(
    () => trustedNextUrl("https://testnet.mirrornode.hedera.com", "https://evil.example/messages"),
    /unexpected origin/i,
  );
});
