import { getProvenanceConfig } from "./config";
import { ProvenanceAttestation, parseAttestation } from "./domain";
import { ProvenanceError, upstreamError } from "./errors";
import { fetchWithTimeout, readJsonWithLimit, trustedNextUrl } from "./network";

type MirrorMessage = {
  consensus_timestamp?: unknown;
  message?: unknown;
  sequence_number?: unknown;
};

type MirrorResponse = {
  messages?: MirrorMessage[];
  links?: {
    next?: string | null;
  };
};

export type MirrorMatch = {
  sequenceNumber: number;
  consensusTimestamp: string;
  attestation: ProvenanceAttestation;
};

function decodeAttestation(message: MirrorMessage): ProvenanceAttestation | null {
  if (typeof message.message !== "string") return null;
  try {
    const decoded = Buffer.from(message.message, "base64").toString("utf8");
    return parseAttestation(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export async function findMirrorAttestation(cid: string, digest: string): Promise<MirrorMatch | null> {
  const config = getProvenanceConfig();
  let url = `${config.mirrorNodeUrl}/api/v1/topics/${encodeURIComponent(config.topicId)}/messages?limit=100&order=desc`;

  for (let page = 0; page < config.mirrorMaxPages; page += 1) {
    const response = await fetchWithTimeout(url, { cache: "no-store" }, config.externalTimeoutMs);
    if (!response.ok) throw upstreamError(`Mirror Node returned HTTP ${response.status}.`);

    const payload = await readJsonWithLimit<MirrorResponse>(response);
    for (const message of payload.messages ?? []) {
      const attestation = decodeAttestation(message);
      if (
        attestation &&
        attestation.cid === cid &&
        attestation.sha256.toLowerCase() === digest.toLowerCase() &&
        typeof message.sequence_number === "number" &&
        Number.isSafeInteger(message.sequence_number) &&
        typeof message.consensus_timestamp === "string"
      ) {
        return {
          sequenceNumber: message.sequence_number,
          consensusTimestamp: message.consensus_timestamp,
          attestation,
        };
      }
    }

    const next = payload.links?.next;
    if (!next) return null;
    if (page === config.mirrorMaxPages - 1) {
      throw new ProvenanceError("MIRROR_SCAN_LIMIT", "Mirror Node scan limit reached before the topic history ended.", {
        status: 503,
      });
    }
    url = trustedNextUrl(config.mirrorNodeUrl, next);
  }

  return null;
}
