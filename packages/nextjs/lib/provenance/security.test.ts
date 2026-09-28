import { AuthenticationError, ConfigurationError } from "./errors";
import { assertWriteAuthorized } from "./security";
import assert from "node:assert/strict";
import test from "node:test";

test("configured write API key is compared before allowing a costly write", () => {
  const previous = process.env.PROVENANCE_WRITE_API_KEY;
  process.env.PROVENANCE_WRITE_API_KEY = "correct-secret";

  try {
    assert.doesNotThrow(() =>
      assertWriteAuthorized(new Request("http://localhost", { headers: { Authorization: "Bearer correct-secret" } })),
    );
    assert.throws(
      () => assertWriteAuthorized(new Request("http://localhost", { headers: { Authorization: "Bearer wrong" } })),
      AuthenticationError,
    );
  } finally {
    if (previous === undefined) delete process.env.PROVENANCE_WRITE_API_KEY;
    else process.env.PROVENANCE_WRITE_API_KEY = previous;
  }
});

test("production refuses unauthenticated write mode when no key is configured", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousKey = env.PROVENANCE_WRITE_API_KEY;
  const previousNodeEnv = env.NODE_ENV;
  delete env.PROVENANCE_WRITE_API_KEY;
  env.NODE_ENV = "production";

  try {
    assert.throws(() => assertWriteAuthorized(new Request("http://localhost")), ConfigurationError);
  } finally {
    if (previousKey === undefined) delete env.PROVENANCE_WRITE_API_KEY;
    else env.PROVENANCE_WRITE_API_KEY = previousKey;
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
  }
});
