import { readResponseBytesLimited, withAbortTimeout } from "../async-utils";
import { parseProvenanceAttestation } from "../domain";
import { UpstreamError } from "../errors";
import type { AttestationReader, MirrorAttestation } from "../ports";

type MirrorMessage = {
  consensus_timestamp?: unknown;
  message?: unknown;
  sequence_number?: unknown;
};

const MAX_MIRROR_RESPONSE_BYTES = 1024 * 1024;

type MirrorResponse = {
  messages?: MirrorMessage[];
  links?: { next?: string | null };
};

export class HederaMirrorNodeReader implements AttestationReader {
  private readonly baseUrl: URL;

  constructor(
    mirrorBaseUrl: string,
    private readonly timeoutMs: number,
    private readonly maxPages: number,
    private readonly topicId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.baseUrl = new URL(mirrorBaseUrl);
  }

  async getBySequence(sequenceNumber: number): Promise<MirrorAttestation | null> {
    const url = new URL(`/api/v1/topics/${encodeURIComponent(this.topicId)}/messages/${sequenceNumber}`, this.baseUrl);
    const payload = await this.fetchJson(url, true);
    const message = payload.messages?.[0];
    return message ? this.decodeMessage(message) : null;
  }

  async findMatching(cid: string, sha256: string): Promise<MirrorAttestation | null> {
    let next: URL | null = new URL(
      `/api/v1/topics/${encodeURIComponent(this.topicId)}/messages?limit=100&order=desc`,
      this.baseUrl,
    );

    for (let page = 0; next && page < this.maxPages; page += 1) {
      const payload = await this.fetchJson(next, false);
      for (const message of payload.messages ?? []) {
        const decoded = this.decodeMessage(message);
        if (
          decoded &&
          decoded.attestation.cid === cid &&
          decoded.attestation.sha256.toLowerCase() === sha256.toLowerCase()
        ) {
          return decoded;
        }
      }
      next = this.resolveNext(payload.links?.next);
    }

    return null;
  }

  private async fetchJson(url: URL, notFoundIsEmpty: boolean): Promise<MirrorResponse> {
    try {
      const response = await withAbortTimeout(this.timeoutMs, "Mirror Node request", signal =>
        this.fetcher(url, { cache: "no-store", signal }),
      );
      if (notFoundIsEmpty && response.status === 404) return { messages: [] };
      if (!response.ok) throw new UpstreamError(`Mirror Node returned HTTP ${response.status}.`);
      const bytes = await readResponseBytesLimited(response, MAX_MIRROR_RESPONSE_BYTES, "Mirror Node response");
      return JSON.parse(new TextDecoder().decode(bytes)) as MirrorResponse;
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError("Mirror Node request failed.", { cause: error });
    }
  }

  private resolveNext(next: string | null | undefined): URL | null {
    if (!next) return null;
    const resolved = new URL(next, this.baseUrl);
    if (resolved.origin !== this.baseUrl.origin) {
      throw new UpstreamError("Mirror Node returned an unsafe pagination URL.");
    }
    return resolved;
  }

  private decodeMessage(message: MirrorMessage): MirrorAttestation | null {
    if (
      typeof message.message !== "string" ||
      typeof message.consensus_timestamp !== "string" ||
      !Number.isSafeInteger(message.sequence_number) ||
      Number(message.sequence_number) <= 0
    ) {
      return null;
    }

    try {
      const decoded = Buffer.from(message.message, "base64").toString("utf8");
      const attestation = parseProvenanceAttestation(JSON.parse(decoded));
      return {
        attestation,
        sequenceNumber: Number(message.sequence_number),
        consensusTimestamp: message.consensus_timestamp,
      };
    } catch {
      return null;
    }
  }
}
