import { ConfigurationError } from "./errors";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigurationError(`Missing required server environment variable: ${name}`);
  return value;
}

function parseHttpUrl(name: string, fallback: string): string {
  const raw = process.env[name]?.trim() || fallback;
  let url: URL;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new ConfigurationError(`${name} must be an absolute HTTP(S) URL.`, { cause: error } as ErrorOptions);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ConfigurationError(`${name} must use http or https.`);
  }
  if (url.username || url.password) {
    throw new ConfigurationError(`${name} must not contain embedded credentials.`);
  }
  return url.toString().replace(/\/$/, "");
}

function parsePositiveInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ConfigurationError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

export type ReadConfig = {
  topicId: string;
  mirrorBaseUrl: string;
  gatewayBaseUrl: string;
  mirrorTimeoutMs: number;
  gatewayTimeoutMs: number;
  mirrorMaxPages: number;
};

export type WriteConfig = ReadConfig & {
  operatorId: string;
  operatorKey: string;
  ipfsApiUrl: string;
  ipfsTimeoutMs: number;
};

export function loadReadConfig(): ReadConfig {
  return {
    topicId: required("HEDERA_TOPIC_ID"),
    mirrorBaseUrl: parseHttpUrl("HEDERA_MIRROR_NODE_URL", "https://testnet.mirrornode.hedera.com"),
    gatewayBaseUrl: parseHttpUrl("IPFS_GATEWAY_URL", "http://127.0.0.1:8080"),
    mirrorTimeoutMs: parsePositiveInt("PROVENANCE_MIRROR_TIMEOUT_MS", 10_000, 1_000, 60_000),
    gatewayTimeoutMs: parsePositiveInt("PROVENANCE_GATEWAY_TIMEOUT_MS", 15_000, 1_000, 120_000),
    mirrorMaxPages: parsePositiveInt("PROVENANCE_MIRROR_MAX_PAGES", 10, 1, 100),
  };
}

export function loadWriteConfig(): WriteConfig {
  return {
    ...loadReadConfig(),
    operatorId: required("HEDERA_OPERATOR_ID"),
    operatorKey: required("HEDERA_OPERATOR_KEY"),
    ipfsApiUrl: parseHttpUrl("IPFS_API_URL", "http://127.0.0.1:5001/api/v0"),
    ipfsTimeoutMs: parsePositiveInt("PROVENANCE_IPFS_TIMEOUT_MS", 20_000, 1_000, 120_000),
  };
}

export function getWriteApiKey(): string | null {
  return process.env.PROVENANCE_WRITE_API_KEY?.trim() || null;
}

export function getWriteConcurrencyLimit(): number {
  return parsePositiveInt("PROVENANCE_MAX_CONCURRENT_WRITES", 2, 1, 16);
}
