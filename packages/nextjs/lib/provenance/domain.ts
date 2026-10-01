import { invalidInput, payloadTooLarge } from "./errors";
import crypto from "node:crypto";

export const PROVENANCE_SCHEMA = "rag-provenance-v1";
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_MULTIPART_BODY_BYTES = MAX_EVIDENCE_BYTES + 512 * 1024;
export const MAX_SOURCE_URI_CHARS = 512;
export const MAX_TITLE_CHARS = 160;
export const MAX_MIME_TYPE_CHARS = 128;
export const MAX_CID_CHARS = 128;
export const MAX_ATTESTATION_BYTES = 1024;

const CID_PATTERN = /^[A-Za-z0-9]+$/;
const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g;

export type ProvenanceAttestation = {
  schema: typeof PROVENANCE_SCHEMA;
  cid: string;
  sha256: string;
  sourceUri: string | null;
  title: string | null;
  mimeType: string;
  size: number;
  capturedAt: string;
};

export type AnchorInput = {
  bytes: Uint8Array;
  sourceUri?: string | null;
  title?: string | null;
  mimeType?: string | null;
};

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function validateEvidenceBytes(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) throw invalidInput("Evidence file is empty.");
  if (bytes.byteLength > MAX_EVIDENCE_BYTES) {
    throw payloadTooLarge("Evidence exceeds the 5 MiB template limit.");
  }
}

export function normalizeCid(raw: string): string {
  const cid = raw.trim();
  if (cid.length < 20 || cid.length > MAX_CID_CHARS || !CID_PATTERN.test(cid)) {
    throw invalidInput("CID is invalid.");
  }
  return cid;
}

export function normalizeSequenceNumber(raw?: number | string | null): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidInput("HCS sequence number is invalid.");
  }
  return value;
}

function cleanText(raw: string, maxChars: number, label: string): string {
  const value = raw.replace(CONTROL_CHARACTERS, "").trim();
  if (value.length > maxChars) throw invalidInput(`${label} is too long.`);
  return value;
}

export function normalizeSourceUri(raw?: string | null): string | null {
  const value = cleanText(raw ?? "", MAX_SOURCE_URI_CHARS, "Source URI");
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalidInput("Source URI must be a valid HTTP(S) URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw invalidInput("Source URI must use HTTP or HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw invalidInput("Source URI must not contain embedded credentials.");
  }

  return parsed.toString();
}

export function normalizeTitle(raw?: string | null): string | null {
  const value = cleanText(raw ?? "", MAX_TITLE_CHARS, "Title");
  return value || null;
}

export function normalizeMimeType(raw?: string | null): string {
  const value = cleanText(raw ?? "", MAX_MIME_TYPE_CHARS, "MIME type");
  return value || "application/octet-stream";
}

export function createAttestation(input: {
  cid: string;
  sha256: string;
  sourceUri?: string | null;
  title?: string | null;
  mimeType?: string | null;
  size: number;
  capturedAt: string;
}): ProvenanceAttestation {
  const cid = normalizeCid(input.cid);
  const digest = input.sha256.toLowerCase();
  if (!SHA256_PATTERN.test(digest)) throw invalidInput("SHA-256 digest is invalid.");
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > MAX_EVIDENCE_BYTES) {
    throw invalidInput("Evidence size is invalid.");
  }
  if (Number.isNaN(Date.parse(input.capturedAt))) throw invalidInput("Capture timestamp is invalid.");

  const attestation: ProvenanceAttestation = {
    schema: PROVENANCE_SCHEMA,
    cid,
    sha256: digest,
    sourceUri: normalizeSourceUri(input.sourceUri),
    title: normalizeTitle(input.title),
    mimeType: normalizeMimeType(input.mimeType),
    size: input.size,
    capturedAt: new Date(input.capturedAt).toISOString(),
  };

  serializeAttestation(attestation);
  return attestation;
}

export function serializeAttestation(attestation: ProvenanceAttestation): string {
  const serialized = JSON.stringify(attestation);
  if (Buffer.byteLength(serialized, "utf8") > MAX_ATTESTATION_BYTES) {
    throw invalidInput("Attestation metadata is too large for a single HCS message.");
  }
  return serialized;
}

export function parseAttestation(value: unknown): ProvenanceAttestation | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.schema !== PROVENANCE_SCHEMA) return null;
  if (
    typeof candidate.cid !== "string" ||
    typeof candidate.sha256 !== "string" ||
    typeof candidate.mimeType !== "string" ||
    typeof candidate.size !== "number" ||
    typeof candidate.capturedAt !== "string"
  ) {
    return null;
  }
  if (candidate.sourceUri !== null && typeof candidate.sourceUri !== "string") return null;
  if (candidate.title !== null && typeof candidate.title !== "string") return null;

  let cid: string;
  try {
    cid = normalizeCid(candidate.cid);
  } catch {
    return null;
  }

  const digest = candidate.sha256.toLowerCase();
  if (!SHA256_PATTERN.test(digest)) return null;
  if (!Number.isSafeInteger(candidate.size) || candidate.size <= 0) return null;
  if (Number.isNaN(Date.parse(candidate.capturedAt))) return null;

  // Verification must remain compatible with already-published v1 messages.
  // New writes use the stricter HTTP(S)/length normalization above, but old
  // v1 HCS records may legitimately contain values such as doi: URIs or
  // longer titles. Preserve those fields when reading historical messages.
  return {
    schema: PROVENANCE_SCHEMA,
    cid,
    sha256: digest,
    sourceUri: candidate.sourceUri as string | null,
    title: candidate.title as string | null,
    mimeType: candidate.mimeType,
    size: candidate.size,
    capturedAt: candidate.capturedAt,
  };
}
