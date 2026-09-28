import { requireWriteAuthorization } from "../../lib/provenance/security";
import assert from "node:assert/strict";
import test from "node:test";

function withEnvironment(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("local development can run without a write token", () => {
  withEnvironment({ NODE_ENV: "development", PROVENANCE_WRITE_TOKEN: undefined }, () => {
    assert.doesNotThrow(() => requireWriteAuthorization(new Request("http://localhost/api")));
  });
});

test("production write endpoint is disabled when no token is configured", () => {
  withEnvironment({ NODE_ENV: "production", PROVENANCE_WRITE_TOKEN: undefined }, () => {
    assert.throws(() => requireWriteAuthorization(new Request("https://example.com/api")), /disabled/i);
  });
});

test("configured write token requires a matching bearer token", () => {
  withEnvironment({ NODE_ENV: "production", PROVENANCE_WRITE_TOKEN: "secret-value" }, () => {
    assert.throws(() => requireWriteAuthorization(new Request("https://example.com/api")), /Unauthorized/i);
    assert.doesNotThrow(() =>
      requireWriteAuthorization(
        new Request("https://example.com/api", {
          headers: { Authorization: "Bearer secret-value" },
        }),
      ),
    );
  });
});
