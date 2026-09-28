import { create as createIpfsClient } from "kubo-rpc-client";

import { MAX_EVIDENCE_BYTES } from "./core";
import type { ProvenanceConfig } from "./config";
import { ExternalServiceError, fetchWithTimeout, readBytesLimited } from "./http";

export async function pinEvidence(bytes: Uint8Array, config: ProvenanceConfig): Promise<string> {
  const ipfs = createIpfsClient({ url: config.ipfsApiUrl });
  try {
    const added = await ipfs.add(bytes, { pin: true, timeout: config.externalTimeoutMs });
    return added.cid.toString();
  } catch {
    throw new ExternalServiceError("IPFS", "IPFS add/pin failed");
  }
}

export async function fetchEvidence(cid: string, config: ProvenanceConfig): Promise<Uint8Array> {
  const response = await fetchWithTimeout(
    "IPFS gateway",
    `${config.ipfsGatewayUrl}/ipfs/${encodeURIComponent(cid)}`,
    { cache: "no-store", redirect: "error" },
    config.externalTimeoutMs,
  );
  if (!response.ok) {
    throw new ExternalServiceError("IPFS gateway", `IPFS gateway returned HTTP ${response.status}`);
  }
  return readBytesLimited("IPFS gateway", response, MAX_EVIDENCE_BYTES);
}
