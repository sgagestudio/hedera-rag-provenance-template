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

function matchMirrorMessage(message: MirrorMessage, cid: string, digest: string): MirrorMatch | null {
  const attestation = decodeAttestation(message);
  if (
    !attestation ||
    attestation.cid !== cid ||
    attestation.sha256.toLowerCase() !== digest.toLowerCase() ||
    typeof message.sequence_number !== "number" ||
    !Number.isSafeInteger(message.sequence_number) ||
    typeof message.consensus_timestamp !== "string"
  ) {
    return null;
  }

  return {
    sequenceNumber: message.sequence_number,
    consensusTimestamp: message.consensus_timestamp,
    attestation,
  };
}

export async function findMirrorAttestation(
  cid: string,
  digest: string,
  sequenceNumber?: number,
): Promise<MirrorMatch | null> {
  const config = getProvenanceConfig();

  if (sequenceNumber !== undefined) {
    const directUrl = `${config.mirrorNodeUrl}/api/v1/topics/${encodeURIComponent(config.topicId)}/messages/${sequenceNumber}`;
    return fetchWithTimeout(directUrl, { cache: "no-store" }, config.externalTimeoutMs, async directResponse => {
      if (directResponse.status === 404) return null;
      if (!directResponse.ok) throw upstreamError(`Mirror Node returned HTTP ${directResponse.status}.`);

      const directMessage = await readJsonWithLimit<MirrorMessage>(directResponse);
      return matchMirrorMessage(directMessage, cid, digest);
    });
  }

  let url = `${config.mirrorNodeUrl}/api/v1/topics/${encodeURIComponent(config.topicId)}/messages?limit=100&order=desc`;

  for (let page = 0; page < config.mirrorMaxPages; page += 1) {
    const payload = await fetchWithTimeout(url, { cache: "no-store" }, config.externalTimeoutMs, async response => {
      if (!response.ok) throw upstreamError(`Mirror Node returned HTTP ${response.status}.`);
      return readJsonWithLimit<MirrorResponse>(response);
    });

    for (const message of payload.messages ?? []) {
      const match = matchMirrorMessage(message, cid, digest);
      if (match) return match;
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
