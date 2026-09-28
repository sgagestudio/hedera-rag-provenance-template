import {
  normalizeCid,
  normalizeMimeType,
  normalizeSequenceNumber,
  normalizeSourceUri,
  normalizeTitle,
  PROVENANCE_SCHEMA,
  sha256Hex,
  validateEvidenceBytes,
} from "./core";
import type { ProvenanceAttestation } from "./core";
import { getProvenanceConfig } from "./config";
import { submitAttestation } from "./hedera";
import { fetchEvidence, pinEvidence } from "./ipfs";
import { findMirrorAttestation } from "./mirror";

export type AnchorInput = {
  bytes: Uint8Array;
  sourceUri?: string | null;
  title?: string | null;
  mimeType?: string | null;
};

export type AnchorResult = ProvenanceAttestation & {
  topicId: string;
  transactionId: string;
  status: string;
};

export async function anchorEvidence(input: AnchorInput): Promise<AnchorResult> {
  validateEvidenceBytes(input.bytes);
  const config = getProvenanceConfig();
  const digest = sha256Hex(input.bytes);
  const cid = await pinEvidence(input.bytes, config);

  const attestation: ProvenanceAttestation = {
    schema: PROVENANCE_SCHEMA,
    cid,
    sha256: digest,
    sourceUri: normalizeSourceUri(input.sourceUri),
    title: normalizeTitle(input.title),
    mimeType: normalizeMimeType(input.mimeType),
    size: input.bytes.byteLength,
    capturedAt: new Date().toISOString(),
  };

  const transaction = await submitAttestation(config.topicId, attestation);
  return { ...attestation, topicId: config.topicId, ...transaction };
}

export async function verifyEvidence(
  rawCid: string,
  rawSequenceNumber?: number | null,
): Promise<{
  verified: boolean;
  cid: string;
  sha256: string;
  topicId: string;
  sequenceNumber: number | null;
  consensusTimestamp: string | null;
  attestation: ProvenanceAttestation | null;
}> {
  const cid = normalizeCid(rawCid);
  const sequenceNumber = normalizeSequenceNumber(rawSequenceNumber);
  const config = getProvenanceConfig();

  const bytes = await fetchEvidence(cid, config);
  validateEvidenceBytes(bytes);
  const digest = sha256Hex(bytes);
  const found = await findMirrorAttestation(config, cid, digest, bytes.byteLength, sequenceNumber);

  return {
    verified: Boolean(found),
    cid,
    sha256: digest,
    topicId: config.topicId,
    sequenceNumber: found?.sequenceNumber ?? null,
    consensusTimestamp: found?.consensusTimestamp ?? null,
    attestation: found?.attestation ?? null,
  };
}
