import assert from "node:assert/strict";
import test from "node:test";
import { assertWriteAuthorized } from "./security";
import { AuthenticationError, ConfigurationError } from "./errors";

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
  const previousKey = process.env.PROVENANCE_WRITE_API_KEY;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.PROVENANCE_WRITE_API_KEY;
  process.env.NODE_ENV = "production";

  try {
    assert.throws(() => assertWriteAuthorized(new Request("http://localhost")), ConfigurationError);
  } finally {
    if (previousKey === undefined) delete process.env.PROVENANCE_WRITE_API_KEY;
    else process.env.PROVENANCE_WRITE_API_KEY = previousKey;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
