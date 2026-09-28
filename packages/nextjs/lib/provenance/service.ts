import { createProvenanceService } from "./application";
import { getProvenanceConfig } from "./config";
import { submitAttestationToHedera } from "./hedera";
import { addEvidenceToIpfs, fetchEvidenceFromIpfs } from "./ipfs";
import { findMirrorAttestation } from "./mirror";

export { createProvenanceService } from "./application";
export type { AnchorResult, ProvenanceDependencies, VerifyResult } from "./application";

const service = createProvenanceService({
  addEvidence: addEvidenceToIpfs,
  fetchEvidence: fetchEvidenceFromIpfs,
  submitAttestation: submitAttestationToHedera,
  findAttestation: findMirrorAttestation,
  now: () => new Date(),
  topicId: () => getProvenanceConfig().topicId,
});

export const anchorEvidence = service.anchorEvidence;
export const verifyEvidence = service.verifyEvidence;
