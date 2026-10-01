import {
  AnchorInput,
  MAX_CID_CHARS,
  ProvenanceAttestation,
  createAttestation,
  normalizeCid,
  normalizeSequenceNumber,
  sha256Hex,
  validateEvidenceBytes,
} from "./domain";
import type { MirrorMatch } from "./mirror";

export type AnchorResult = ProvenanceAttestation & {
  topicId: string;
  transactionId: string;
  status: string;
  sequenceNumber: number;
};

export type VerifyResult = {
  verified: boolean;
  cid: string;
  sha256: string;
  topicId: string;
  sequenceNumber: number | null;
  consensusTimestamp: string | null;
  attestation: ProvenanceAttestation | null;
};

export type ProvenanceDependencies = {
  addEvidence: (bytes: Uint8Array) => Promise<string>;
  fetchEvidence: (cid: string) => Promise<Uint8Array>;
  submitAttestation: (attestation: ProvenanceAttestation) => Promise<{
    topicId: string;
    transactionId: string;
    status: string;
    sequenceNumber: number;
  }>;
  findAttestation: (cid: string, digest: string, sequenceNumber?: number) => Promise<MirrorMatch | null>;
  now: () => Date;
  topicId: () => string;
};

export function createProvenanceService(dependencies: ProvenanceDependencies) {
  return {
    async anchorEvidence(input: AnchorInput): Promise<AnchorResult> {
      validateEvidenceBytes(input.bytes);
      const digest = sha256Hex(input.bytes);
      const capturedAt = dependencies.now().toISOString();

      // Validate all metadata and the worst-case serialized HCS payload before
      // pinning bytes in IPFS. This prevents rejected requests from leaving
      // orphaned permanent pins behind.
      const preflight = createAttestation({
        cid: "Q".repeat(MAX_CID_CHARS),
        sha256: digest,
        sourceUri: input.sourceUri,
        title: input.title,
        mimeType: input.mimeType,
        size: input.bytes.byteLength,
        capturedAt,
      });

      const cid = normalizeCid(await dependencies.addEvidence(input.bytes));
      const attestation = createAttestation({
        cid,
        sha256: digest,
        sourceUri: preflight.sourceUri,
        title: preflight.title,
        mimeType: preflight.mimeType,
        size: input.bytes.byteLength,
        capturedAt,
      });
      const submitted = await dependencies.submitAttestation(attestation);
      return { ...attestation, ...submitted };
    },

    async verifyEvidence(rawCid: string, rawSequenceNumber?: number | string | null): Promise<VerifyResult> {
      const cid = normalizeCid(rawCid);
      const sequenceNumber = normalizeSequenceNumber(rawSequenceNumber);
      const bytes = await dependencies.fetchEvidence(cid);
      validateEvidenceBytes(bytes);
      const digest = sha256Hex(bytes);
      const match = await dependencies.findAttestation(cid, digest, sequenceNumber);
      const verified = Boolean(match && match.attestation.size === bytes.byteLength);

      return {
        verified,
        cid,
        sha256: digest,
        topicId: dependencies.topicId(),
        sequenceNumber: verified ? match!.sequenceNumber : null,
        consensusTimestamp: verified ? match!.consensusTimestamp : null,
        attestation: verified ? match!.attestation : null,
      };
    },
  };
}
