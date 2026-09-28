import crypto from "node:crypto";

import { getProvenanceConfig } from "./config";
import { ProvenanceError } from "./errors";

let inFlightAnchors = 0;

function tokenDigest(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

export function requireWriteAuthorization(request: Request): void {
  const expected = process.env.PROVENANCE_WRITE_TOKEN?.trim();

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      throw new ProvenanceError(
        "WRITE_DISABLED",
        "Anchoring is disabled until PROVENANCE_WRITE_TOKEN is configured.",
        { status: 503, expose: true },
      );
    }
    return;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  const candidate = authorization.startsWith(prefix) ? authorization.slice(prefix.length).trim() : "";

  if (!candidate || !crypto.timingSafeEqual(tokenDigest(candidate), tokenDigest(expected))) {
    throw new ProvenanceError("UNAUTHORIZED", "Unauthorized.", { status: 401, expose: true });
  }
}

export function acquireAnchorSlot(): () => void {
  const { maxInflightAnchors } = getProvenanceConfig();
  if (inFlightAnchors >= maxInflightAnchors) {
    throw new ProvenanceError("BUSY", "Too many provenance writes are already in progress.", {
      status: 429,
      expose: true,
    });
  }

  inFlightAnchors += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlightAnchors = Math.max(0, inFlightAnchors - 1);
  };
}
