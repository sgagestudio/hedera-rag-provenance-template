import { ConcurrencyGate } from "./async-utils";
import { getWriteApiKey, getWriteConcurrencyLimit } from "./config";
import { AuthenticationError, CapacityError, ConfigurationError } from "./errors";
import crypto from "node:crypto";

const writeGate = new ConcurrencyGate(getWriteConcurrencyLimit());

function credentialFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || null;
  }
  return request.headers.get("x-provenance-api-key")?.trim() || null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) return false;
  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

export function assertWriteAuthorized(request: Request): void {
  const configured = getWriteApiKey();

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new ConfigurationError("PROVENANCE_WRITE_API_KEY must be configured in production.");
    }
    return;
  }

  const supplied = credentialFromRequest(request);
  if (!supplied || !safeEqual(supplied, configured)) {
    throw new AuthenticationError();
  }
}

export async function withWriteCapacity<T>(work: () => Promise<T>): Promise<T> {
  const release = writeGate.tryAcquire();
  if (!release) throw new CapacityError();

  try {
    return await work();
  } finally {
    release();
  }
}
