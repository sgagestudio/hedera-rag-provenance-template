import {
  MAX_EVIDENCE_BYTES,
  PROVENANCE_SCHEMA,
  assertEvidenceSize,
  canonicalizeCid,
  normalizeMimeType,
  normalizeSourceUri,
  normalizeTitle,
  sha256Hex,
  type AnchorEvidenceInput,
  type AnchorEvidenceResult,
  type ProvenanceAttestation,
  type VerifyEvidenceResult,
} from "./domain";
import { ConfigurationError, ValidationError } from "./errors";
import type { AttestationPublisher, AttestationReader, EvidenceStore, MirrorAttestation } from "./ports";

export class ProvenanceService {
  constructor(
    private readonly topicId: string,
    private readonly evidenceStore: EvidenceStore,
    private readonly attestationReader?: AttestationReader,
    private readonly attestationPublisher?: AttestationPublisher,
  ) {}

  async anchor(input: AnchorEvidenceInput): Promise<AnchorEvidenceResult> {
    if (!this.attestationPublisher) {
      throw new ConfigurationError("Provenance write adapter is not configured.");
    }

    assertEvidenceSize(input.bytes);

    const cid = await this.evidenceStore.add(input.bytes);
    const attestation: ProvenanceAttestation = {
      schema: PROVENANCE_SCHEMA,
      cid: canonicalizeCid(cid),
      sha256: sha256Hex(input.bytes),
      sourceUri: normalizeSourceUri(input.sourceUri),
      title: normalizeTitle(input.title),
      mimeType: normalizeMimeType(input.mimeType),
      size: input.bytes.byteLength,
      capturedAt: new Date().toISOString(),
    };

    const published = await this.attestationPublisher.publish(attestation);
    if (published.status !== "SUCCESS") {
      throw new ConfigurationError("Hedera did not accept the provenance attestation.");
    }

    return {
      ...attestation,
      topicId: this.topicId,
      transactionId: published.transactionId,
      status: published.status,
      sequenceNumber: published.sequenceNumber,
    };
  }

  async verify(cidValue: string, sequenceNumber?: number | null): Promise<VerifyEvidenceResult> {
    if (!this.attestationReader) {
      throw new ConfigurationError("Provenance read adapter is not configured.");
    }

    const cid = canonicalizeCid(cidValue);
    if (sequenceNumber != null && (!Number.isSafeInteger(sequenceNumber) || sequenceNumber <= 0)) {
      throw new ValidationError("sequenceNumber must be a positive integer.");
    }

    if (sequenceNumber != null) {
      const [bytes, mirror] = await Promise.all([
        this.evidenceStore.read(cid, MAX_EVIDENCE_BYTES),
        this.attestationReader.getBySequence(sequenceNumber),
      ]);
      return this.buildVerificationResult(cid, bytes, mirror);
    }

    const bytes = await this.evidenceStore.read(cid, MAX_EVIDENCE_BYTES);
    const digest = sha256Hex(bytes);
    const mirror = await this.attestationReader.findMatching(cid, digest);
    return this.buildVerificationResult(cid, bytes, mirror);
  }

  private buildVerificationResult(
    cid: string,
    bytes: Uint8Array,
    mirror: MirrorAttestation | null,
  ): VerifyEvidenceResult {
    const digest = sha256Hex(bytes);
    const verified =
      mirror !== null &&
      mirror.attestation.schema === PROVENANCE_SCHEMA &&
      mirror.attestation.cid === cid &&
      mirror.attestation.sha256.toLowerCase() === digest.toLowerCase() &&
      mirror.attestation.size === bytes.byteLength;

    return {
      verified,
      cid,
      sha256: digest,
      topicId: this.topicId,
      sequenceNumber: verified ? mirror.sequenceNumber : null,
      consensusTimestamp: verified ? mirror.consensusTimestamp : null,
      attestation: verified ? mirror.attestation : null,
    };
  }
}
