import assert from "node:assert/strict";
import test from "node:test";

import { ExternalServiceError, readBytesLimited, readJsonLimited } from "../../lib/provenance/http";

test("bounded response reader prevents oversized chunked bodies", async () => {
  const response = new Response(new Uint8Array([1, 2, 3, 4, 5]));
  await assert.rejects(() => readBytesLimited("fixture", response, 4), ExternalServiceError);
});

test("bounded json reader rejects malformed external payloads", async () => {
  const response = new Response("{not-json");
  await assert.rejects(() => readJsonLimited("fixture", response, 1024), /invalid JSON/);
});
