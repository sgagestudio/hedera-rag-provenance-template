import { getProvenanceConfig } from "./config";
import { MAX_EVIDENCE_BYTES } from "./domain";
import { upstreamError } from "./errors";
import { fetchWithTimeout, readBytesWithLimit } from "./network";
import { create as createIpfsClient } from "kubo-rpc-client";

export async function addEvidenceToIpfs(bytes: Uint8Array): Promise<string> {
  const config = getProvenanceConfig();
  const ipfs = createIpfsClient({ url: config.ipfsApiUrl });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.externalTimeoutMs);

  try {
    const added = await ipfs.add(bytes, { pin: true, signal: controller.signal });
    return added.cid.toString();
  } catch (cause) {
    if (controller.signal.aborted) throw upstreamError("IPFS add timed out.", cause);
    throw upstreamError("IPFS add failed.", cause);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchEvidenceFromIpfs(cid: string): Promise<Uint8Array> {
  const config = getProvenanceConfig();
  return fetchWithTimeout(
    `${config.ipfsGatewayUrl}/ipfs/${encodeURIComponent(cid)}`,
    { cache: "no-store" },
    config.externalTimeoutMs,
    async response => {
      if (!response.ok) throw upstreamError(`IPFS gateway returned HTTP ${response.status}.`);
      return readBytesWithLimit(response, MAX_EVIDENCE_BYTES);
    },
  );
}
