import { ValidationError } from "./errors";
import crypto from "node:crypto";

export const PROVENANCE_SCHEMA = "rag-provenance-v1";
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_SOURCE_URI_LENGTH = 512;
export const MAX_TITLE_LENGTH = 128;
export const MAX_MIME_TYPE_LENGTH = 64;
export const MAX_HCS_MESSAGE_BYTES = 1024;

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

export type AnchorEvidenceInput = {
  bytes: Uint8Array;
  sourceUri?: string | null;
  title?: string | null;
  mimeType?: string | null;
};

export type AnchorEvidenceResult = ProvenanceAttestation & {
  topicId: string;
  transactionId: string;
  status: string;
  sequenceNumber: number;
};

export type VerifyEvidenceResult = {
  verified: boolean;
  cid: string;
  sha256: string;
  topicId: string;
  sequenceNumber: number | null;
  consensusTimestamp: string | null;
  attestation: ProvenanceAttestation | null;
};

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function serializeAttestation(attestation: ProvenanceAttestation): string {
  const serialized = JSON.stringify(attestation);
  if (Buffer.byteLength(serialized, "utf8") > MAX_HCS_MESSAGE_BYTES) {
    throw new ValidationError(`Attestation exceeds the ${MAX_HCS_MESSAGE_BYTES} byte HCS message limit.`);
  }
  return serialized;
}

export function assertEvidenceSize(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) throw new ValidationError("Evidence file is empty.");
  if (bytes.byteLength > MAX_EVIDENCE_BYTES) {
    throw new ValidationError(`Evidence exceeds the ${MAX_EVIDENCE_BYTES} byte template limit.`);
  }
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number, field: string): string | null {
  const normalized = value?.trim() || null;
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} exceeds the ${maxLength} character limit.`);
  }
  if (/[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new ValidationError(`${field} contains control characters.`);
  }
  return normalized;
}

export function normalizeSourceUri(value: string | null | undefined): string | null {
  return normalizeOptionalText(value, MAX_SOURCE_URI_LENGTH, "sourceUri");
}

export function normalizeTitle(value: string | null | undefined): string | null {
  return normalizeOptionalText(value, MAX_TITLE_LENGTH, "title");
}

export function normalizeMimeType(value: string | null | undefined): string {
  const normalized = normalizeOptionalText(value, MAX_MIME_TYPE_LENGTH, "mimeType") || "application/octet-stream";
  if (!/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(normalized)) {
    throw new ValidationError("mimeType is invalid.");
  }
  return normalized;
}

export function canonicalizeCid(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ValidationError("cid is required.");
  if (normalized.length > 128) throw new ValidationError("cid is too long.");

  const cidV0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  const cidV1Base32 = /^b[a-z2-7]{20,127}$/;
  if (!cidV0.test(normalized) && !cidV1Base32.test(normalized)) {
    throw new ValidationError("cid is invalid.");
  }
  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProvenanceAttestation(value: unknown): ProvenanceAttestation {
  if (!isPlainObject(value)) throw new ValidationError("Attestation is not an object.");
  if (value.schema !== PROVENANCE_SCHEMA) throw new ValidationError("Attestation schema is unsupported.");
  if (typeof value.cid !== "string") throw new ValidationError("Attestation CID is invalid.");
  if (typeof value.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(value.sha256)) {
    throw new ValidationError("Attestation SHA-256 is invalid.");
  }
  if (value.sourceUri !== null && typeof value.sourceUri !== "string") {
    throw new ValidationError("Attestation sourceUri is invalid.");
  }
  if (value.title !== null && typeof value.title !== "string") {
    throw new ValidationError("Attestation title is invalid.");
  }
  if (typeof value.mimeType !== "string") throw new ValidationError("Attestation mimeType is invalid.");
  if (!Number.isSafeInteger(value.size) || Number(value.size) <= 0 || Number(value.size) > MAX_EVIDENCE_BYTES) {
    throw new ValidationError("Attestation size is invalid.");
  }
  if (typeof value.capturedAt !== "string" || Number.isNaN(Date.parse(value.capturedAt))) {
    throw new ValidationError("Attestation capturedAt is invalid.");
  }

  return {
    schema: PROVENANCE_SCHEMA,
    cid: canonicalizeCid(value.cid),
    sha256: value.sha256.toLowerCase(),
    sourceUri: normalizeSourceUri(value.sourceUri as string | null),
    title: normalizeTitle(value.title as string | null),
    mimeType: normalizeMimeType(value.mimeType),
    size: Number(value.size),
    capturedAt: value.capturedAt,
  };
}
