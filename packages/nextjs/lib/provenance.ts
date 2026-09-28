import { HederaHcsPublisher } from "./provenance/adapters/hedera";
import { KuboEvidenceStore } from "./provenance/adapters/ipfs";
import { HederaMirrorNodeReader } from "./provenance/adapters/mirror-node";
import { loadReadConfig, loadWriteConfig } from "./provenance/config";
import type { AnchorEvidenceInput, AnchorEvidenceResult, VerifyEvidenceResult } from "./provenance/domain";
import { ProvenanceService } from "./provenance/service";

export {
  MAX_EVIDENCE_BYTES,
  PROVENANCE_SCHEMA,
  type AnchorEvidenceInput,
  type AnchorEvidenceResult,
  type ProvenanceAttestation,
  type VerifyEvidenceResult,
} from "./provenance/domain";

export async function anchorEvidence(input: AnchorEvidenceInput): Promise<AnchorEvidenceResult> {
  const config = loadWriteConfig();
  const store = new KuboEvidenceStore(
    config.ipfsApiUrl,
    config.gatewayBaseUrl,
    config.ipfsTimeoutMs,
    config.gatewayTimeoutMs,
  );
  const publisher = new HederaHcsPublisher(config.topicId, config.operatorId, config.operatorKey);
  return new ProvenanceService(config.topicId, store, undefined, publisher).anchor(input);
}

export async function verifyEvidence(cid: string, sequenceNumber?: number | null): Promise<VerifyEvidenceResult> {
  const config = loadReadConfig();
  const store = new KuboEvidenceStore(null, config.gatewayBaseUrl, 20_000, config.gatewayTimeoutMs);
  const reader = new HederaMirrorNodeReader(
    config.mirrorBaseUrl,
    config.mirrorTimeoutMs,
    config.mirrorMaxPages,
    config.topicId,
  );
  return new ProvenanceService(config.topicId, store, reader).verify(cid, sequenceNumber);
}
