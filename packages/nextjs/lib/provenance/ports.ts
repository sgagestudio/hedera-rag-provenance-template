import type { ProvenanceAttestation } from "./domain";

export type PublishedAttestation = {
  transactionId: string;
  status: string;
  sequenceNumber: number;
};

export type MirrorAttestation = {
  attestation: ProvenanceAttestation;
  sequenceNumber: number;
  consensusTimestamp: string;
};

export interface EvidenceStore {
  add(bytes: Uint8Array): Promise<string>;
  read(cid: string, maxBytes: number): Promise<Uint8Array>;
}

export interface AttestationPublisher {
  publish(attestation: ProvenanceAttestation): Promise<PublishedAttestation>;
}

export interface AttestationReader {
  getBySequence(sequenceNumber: number): Promise<MirrorAttestation | null>;
  findMatching(cid: string, sha256: string): Promise<MirrorAttestation | null>;
}
