import assert from "node:assert/strict";
import test from "node:test";
import { readResponseBytesLimited, withAbortTimeout } from "./async-utils";
import { UpstreamError } from "./errors";

test("readResponseBytesLimited reads bounded responses", async () => {
  const response = new Response(new Uint8Array([1, 2, 3]));
  const bytes = await readResponseBytesLimited(response, 3, "fixture");
  assert.deepEqual([...bytes], [1, 2, 3]);
});

test("readResponseBytesLimited rejects oversized responses before buffering them", async () => {
  const response = new Response(new Uint8Array([1, 2, 3, 4]), {
    headers: { "content-length": "4" },
  });
  await assert.rejects(() => readResponseBytesLimited(response, 3, "fixture"), UpstreamError);
});

test("withAbortTimeout aborts slow dependencies", async () => {
  await assert.rejects(
    () =>
      withAbortTimeout(10, "slow fixture", signal =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 1_000);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
      ),
    UpstreamError,
  );
});
