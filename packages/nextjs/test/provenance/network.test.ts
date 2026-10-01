import { fetchWithTimeout, readBytesWithLimit, readJsonWithLimit, readRequestBodyWithLimit, trustedNextUrl } from "../../lib/provenance/network";
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


test("request body limit is enforced while streaming without Content-Length", async () => {
  const request = new Request("https://example.com/upload", {
    method: "POST",
    body: "123456",
  });
  await assert.rejects(() => readRequestBodyWithLimit(request, 5), /request body exceeds/i);
});

test("external timeout remains active while consuming a stalled response body", async () => {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    const signal = init?.signal;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
        signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
      },
    });
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    await assert.rejects(
      () =>
        fetchWithTimeout("https://example.com/stall", { cache: "no-store" }, 20, response =>
          readJsonWithLimit(response),
        ),
      /timed out/i,
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
