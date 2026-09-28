export {
  MAX_EVIDENCE_BYTES,
  PROVENANCE_SCHEMA,
  ProvenanceInputError,
  normalizeCid,
  parseAttestation,
  sha256Hex,
} from "./core";
export type { ProvenanceAttestation } from "./core";
export { anchorEvidence, verifyEvidence } from "./service";
export type { AnchorInput, AnchorResult } from "./service";
