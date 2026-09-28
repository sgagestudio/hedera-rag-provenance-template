import { readResponseBytesLimited, withAbortTimeout } from "../async-utils";
import { ConfigurationError, UpstreamError } from "../errors";
import type { EvidenceStore } from "../ports";
import { create as createIpfsClient } from "kubo-rpc-client";

export class KuboEvidenceStore implements EvidenceStore {
  constructor(
    private readonly apiUrl: string | null,
    private readonly gatewayBaseUrl: string,
    private readonly ipfsTimeoutMs: number,
    private readonly gatewayTimeoutMs: number,
  ) {}

  async add(bytes: Uint8Array): Promise<string> {
    if (!this.apiUrl) throw new ConfigurationError("IPFS API is not configured for writes.");
    const client = createIpfsClient({ url: this.apiUrl });

    try {
      const added = await withAbortTimeout(this.ipfsTimeoutMs, "IPFS add", signal =>
        client.add(bytes, { pin: true, signal }),
      );
      return added.cid.toString();
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError("IPFS add failed.", { cause: error });
    }
  }

  async read(cid: string, maxBytes: number): Promise<Uint8Array> {
    const url = `${this.gatewayBaseUrl}/ipfs/${encodeURIComponent(cid)}`;

    try {
      const response = await withAbortTimeout(this.gatewayTimeoutMs, "IPFS gateway request", signal =>
        fetch(url, { cache: "no-store", signal }),
      );
      if (!response.ok) {
        throw new UpstreamError(`IPFS gateway returned HTTP ${response.status}.`);
      }
      return await readResponseBytesLimited(response, maxBytes, "IPFS content");
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError("IPFS gateway request failed.", { cause: error });
    }
  }
}
