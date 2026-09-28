import { configurationError } from "./errors";

const DEFAULT_IPFS_API_URL = "http://127.0.0.1:5001/api/v0";
const DEFAULT_IPFS_GATEWAY_URL = "http://127.0.0.1:8080";
const DEFAULT_MIRROR_NODE_URL = "https://testnet.mirrornode.hedera.com";

export type ProvenanceConfig = {
  topicId: string;
  ipfsApiUrl: string;
  ipfsGatewayUrl: string;
  mirrorNodeUrl: string;
  externalTimeoutMs: number;
  mirrorMaxPages: number;
  maxInflightAnchors: number;
};

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw configurationError(`Missing required server environment variable: ${name}`);
  return value;
}

function boundedInteger(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw configurationError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function normalizedHttpUrl(name: string, fallback: string): string {
  const raw = process.env[name]?.trim() || fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch (cause) {
    throw configurationError(`${name} must be a valid URL.`, cause);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw configurationError(`${name} must use HTTP or HTTPS.`);
  }
  if (url.username || url.password) {
    throw configurationError(`${name} must not include URL credentials.`);
  }

  return url.toString().replace(/\/$/, "");
}

export function getProvenanceConfig(): ProvenanceConfig {
  return {
    topicId: requiredEnv("HEDERA_TOPIC_ID"),
    ipfsApiUrl: normalizedHttpUrl("IPFS_API_URL", DEFAULT_IPFS_API_URL),
    ipfsGatewayUrl: normalizedHttpUrl("IPFS_GATEWAY_URL", DEFAULT_IPFS_GATEWAY_URL),
    mirrorNodeUrl: normalizedHttpUrl("HEDERA_MIRROR_NODE_URL", DEFAULT_MIRROR_NODE_URL),
    externalTimeoutMs: boundedInteger("PROVENANCE_EXTERNAL_TIMEOUT_MS", 10_000, 1_000, 60_000),
    mirrorMaxPages: boundedInteger("PROVENANCE_MIRROR_MAX_PAGES", 20, 1, 100),
    maxInflightAnchors: boundedInteger("PROVENANCE_MAX_INFLIGHT_ANCHORS", 2, 1, 20),
  };
}
