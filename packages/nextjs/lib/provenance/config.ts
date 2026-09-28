export class ProvenanceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvenanceConfigError";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ProvenanceConfigError(`Missing required server configuration: ${name}`);
  return value;
}

function urlEnv(name: string, fallback: string): string {
  const raw = process.env[name]?.trim() || fallback;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ProvenanceConfigError(`Invalid URL in ${name}`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ProvenanceConfigError(`${name} must use http or https`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function intEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ProvenanceConfigError(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export type ProvenanceConfig = {
  topicId: string;
  ipfsApiUrl: string;
  ipfsGatewayUrl: string;
  mirrorNodeUrl: string;
  externalTimeoutMs: number;
  mirrorMaxPages: number;
};

export function getProvenanceConfig(): ProvenanceConfig {
  const topicId = requiredEnv("HEDERA_TOPIC_ID");
  if (!/^\d+\.\d+\.\d+$/.test(topicId)) {
    throw new ProvenanceConfigError("HEDERA_TOPIC_ID has an invalid format");
  }

  return {
    topicId,
    ipfsApiUrl: urlEnv("IPFS_API_URL", "http://127.0.0.1:5001/api/v0"),
    ipfsGatewayUrl: urlEnv("IPFS_GATEWAY_URL", "http://127.0.0.1:8080"),
    mirrorNodeUrl: urlEnv("HEDERA_MIRROR_NODE_URL", "https://testnet.mirrornode.hedera.com"),
    externalTimeoutMs: intEnv("PROVENANCE_EXTERNAL_TIMEOUT_MS", 12_000, 1_000, 60_000),
    mirrorMaxPages: intEnv("PROVENANCE_MIRROR_MAX_PAGES", 20, 1, 100),
  };
}

export function getHederaOperator(): { accountId: string; privateKey: string } {
  return {
    accountId: requiredEnv("HEDERA_OPERATOR_ID"),
    privateKey: requiredEnv("HEDERA_OPERATOR_KEY"),
  };
}
