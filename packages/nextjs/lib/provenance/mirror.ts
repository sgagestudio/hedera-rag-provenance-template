import type { ProvenanceAttestation } from "./core";
import { parseAttestation } from "./core";
import type { ProvenanceConfig } from "./config";
import { ExternalServiceError, fetchWithTimeout, readJsonLimited } from "./http";

const MAX_MIRROR_RESPONSE_BYTES = 2 * 1024 * 1024;

type MirrorMessage = {
  consensus_timestamp?: string;
  message?: string;
  sequence_number?: number;
};

type MirrorResponse = {
  messages?: MirrorMessage[];
  links?: { next?: string | null };
};

export type MirrorMatch = {
  sequenceNumber: number;
  consensusTimestamp: string;
  attestation: ProvenanceAttestation;
};

function decodeMessage(message: MirrorMessage): ProvenanceAttestation | null {
  if (
    typeof message.message !== "string" ||
    !Number.isSafeInteger(message.sequence_number) ||
    typeof message.consensus_timestamp !== "string"
  ) {
    return null;
  }

  try {
    return parseAttestation(JSON.parse(Buffer.from(message.message, "base64").toString("utf8")));
  } catch {
    return null;
  }
}

function matches(
  attestation: ProvenanceAttestation,
  cid: string,
  digest: string,
  byteLength: number,
): boolean {
  return (
    attestation.cid === cid &&
    attestation.sha256.toLowerCase() === digest.toLowerCase() &&
    attestation.size === byteLength
  );
}

async function loadPage(url: string, config: ProvenanceConfig): Promise<MirrorResponse> {
  const response = await fetchWithTimeout(
    "Mirror Node",
    url,
    { cache: "no-store", redirect: "error" },
    config.externalTimeoutMs,
  );
  if (!response.ok) {
    throw new ExternalServiceError("Mirror Node", `Mirror Node returned HTTP ${response.status}`);
  }
  return readJsonLimited<MirrorResponse>("Mirror Node", response, MAX_MIRROR_RESPONSE_BYTES);
}

function matchFromPayload(
  payload: MirrorResponse,
  cid: string,
  digest: string,
  byteLength: number,
): MirrorMatch | null {
  for (const message of payload.messages ?? []) {
    const attestation = decodeMessage(message);
    if (
      attestation &&
      typeof message.sequence_number === "number" &&
      typeof message.consensus_timestamp === "string" &&
      matches(attestation, cid, digest, byteLength)
    ) {
      return {
        sequenceNumber: message.sequence_number,
        consensusTimestamp: message.consensus_timestamp,
        attestation,
      };
    }
  }
  return null;
}

export async function findMirrorAttestation(
  config: ProvenanceConfig,
  cid: string,
  digest: string,
  byteLength: number,
  sequenceNumber?: number | null,
): Promise<MirrorMatch | null> {
  if (sequenceNumber) {
    const url = `${config.mirrorNodeUrl}/api/v1/topics/${encodeURIComponent(config.topicId)}/messages/${sequenceNumber}`;
    const response = await fetchWithTimeout(
      "Mirror Node",
      url,
      { cache: "no-store", redirect: "error" },
      config.externalTimeoutMs,
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new ExternalServiceError("Mirror Node", `Mirror Node returned HTTP ${response.status}`);
    }

    const message = await readJsonLimited<MirrorMessage>("Mirror Node", response, MAX_MIRROR_RESPONSE_BYTES);
    const attestation = decodeMessage(message);
    return attestation &&
      typeof message.sequence_number === "number" &&
      typeof message.consensus_timestamp === "string" &&
      matches(attestation, cid, digest, byteLength)
      ? {
          sequenceNumber: message.sequence_number,
          consensusTimestamp: message.consensus_timestamp,
          attestation,
        }
      : null;
  }

  let nextUrl = `${config.mirrorNodeUrl}/api/v1/topics/${encodeURIComponent(config.topicId)}/messages?limit=100&order=desc`;
  const mirrorOrigin = new URL(config.mirrorNodeUrl).origin;

  for (let page = 0; page < config.mirrorMaxPages; page += 1) {
    const payload = await loadPage(nextUrl, config);
    const found = matchFromPayload(payload, cid, digest, byteLength);
    if (found) return found;

    const next = payload.links?.next;
    if (!next) return null;

    const resolved = new URL(next, config.mirrorNodeUrl);
    if (resolved.origin !== mirrorOrigin) {
      throw new ExternalServiceError("Mirror Node", "Mirror Node returned an unsafe pagination link");
    }
    nextUrl = resolved.toString();
  }

  return null;
}
