import crypto from "node:crypto";

import { MAX_EVIDENCE_BYTES, ProvenanceInputError } from "./core";
import { ProvenanceConfigError } from "./config";
import { ExternalServiceError } from "./http";

const MAX_MULTIPART_OVERHEAD_BYTES = 512 * 1024;

export class ProvenanceApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProvenanceApiError";
  }
}

function equalSecret(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function assertWriteAccess(
  request: Request,
  options: { production?: boolean; token?: string } = {},
): void {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    throw new ProvenanceApiError(403, "Cross-origin writes are not allowed.");
  }

  const production = options.production ?? process.env.NODE_ENV === "production";
  const token = options.token ?? process.env.PROVENANCE_WRITE_TOKEN?.trim();

  if (production && !token) {
    throw new ProvenanceApiError(503, "Provenance writes are disabled until server authentication is configured.");
  }
  if (!token) return;

  const authorization = request.headers.get("authorization") || "";
  const prefix = "Bearer ";
  const candidate = authorization.startsWith(prefix) ? authorization.slice(prefix.length) : "";
  if (!candidate || !equalSecret(candidate, token)) {
    throw new ProvenanceApiError(401, "Authentication is required for provenance writes.");
  }
}

export function assertRequestSize(request: Request): void {
  const contentLength = Number(request.headers.get("content-length"));
  const maximum = MAX_EVIDENCE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;
  if (Number.isFinite(contentLength) && contentLength > maximum) {
    throw new ProvenanceApiError(413, "Request exceeds the upload limit.");
  }
}

export function publicApiError(error: unknown, fallback: string): { status: number; message: string } {
  if (error instanceof ProvenanceApiError || error instanceof ProvenanceInputError) {
    return { status: error.status, message: error.message };
  }
  if (error instanceof ProvenanceConfigError) {
    return { status: 503, message: "Provenance service is not configured." };
  }
  if (error instanceof ExternalServiceError) {
    return {
      status: error.timedOut ? 504 : 502,
      message: error.timedOut ? `${error.service} timed out.` : `${error.service} is unavailable.`,
    };
  }
  return { status: 500, message: fallback };
}
