import "server-only";

import crypto from "node:crypto";

import {
  AccountId,
  Client,
  PrivateKey,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { create as createIpfsClient } from "kubo-rpc-client";

export const PROVENANCE_SCHEMA = "rag-provenance-v1";
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

export type ProvenanceAttestation = {
  schema: typeof PROVENANCE_SCHEMA;
  cid: string;
  sha256: string;
  sourceUri: string | null;
  title: string | null;
  mimeType: string;
  size: number;
  capturedAt: string;
};

type MirrorMessage = {
  consensus_timestamp: string;
  message: string;
  sequence_number: number;
};

type MirrorResponse = {
  messages?: MirrorMessage[];
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function createHederaClient(): Client {
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(requiredEnv("HEDERA_OPERATOR_ID")),
    PrivateKey.fromString(requiredEnv("HEDERA_OPERATOR_KEY")),
  );
  return client;
}

export async function anchorEvidence(input: {
  bytes: Uint8Array;
  sourceUri?: string | null;
  title?: string | null;
  mimeType?: string | null;
}): Promise<ProvenanceAttestation & { topicId: string; transactionId: string; status: string }> {
  if (input.bytes.byteLength === 0) throw new Error("Evidence file is empty.");
  if (input.bytes.byteLength > MAX_EVIDENCE_BYTES) {
    throw new Error(`Evidence exceeds the ${MAX_EVIDENCE_BYTES} byte template limit.`);
  }

  const topicId = requiredEnv("HEDERA_TOPIC_ID");
  const ipfs = createIpfsClient({
    url: process.env.IPFS_API_URL || "http://127.0.0.1:5001/api/v0",
  });

  const added = await ipfs.add(input.bytes, { pin: true });
  const attestation: ProvenanceAttestation = {
    schema: PROVENANCE_SCHEMA,
    cid: added.cid.toString(),
    sha256: sha256Hex(input.bytes),
    sourceUri: input.sourceUri?.trim() || null,
    title: input.title?.trim() || null,
    mimeType: input.mimeType?.trim() || "application/octet-stream",
    size: input.bytes.byteLength,
    capturedAt: new Date().toISOString(),
  };

  const client = createHederaClient();
  try {
    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(JSON.stringify(attestation))
      .execute(client);
    const receipt = await response.getReceipt(client);

    return {
      ...attestation,
      topicId,
      transactionId: response.transactionId.toString(),
      status: receipt.status.toString(),
    };
  } finally {
    client.close();
  }
}

export async function verifyEvidence(cid: string): Promise<{
  verified: boolean;
  cid: string;
  sha256: string;
  topicId: string;
  sequenceNumber: number | null;
  consensusTimestamp: string | null;
  attestation: ProvenanceAttestation | null;
}> {
  const topicId = requiredEnv("HEDERA_TOPIC_ID");
  const gateway = (process.env.IPFS_GATEWAY_URL || "https://ipfs.io").replace(/\/$/, "");
  const contentResponse = await fetch(`${gateway}/ipfs/${encodeURIComponent(cid)}`, { cache: "no-store" });
  if (!contentResponse.ok) throw new Error(`IPFS gateway returned HTTP ${contentResponse.status}`);

  const bytes = new Uint8Array(await contentResponse.arrayBuffer());
  const digest = sha256Hex(bytes);

  const mirror = (process.env.HEDERA_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com").replace(/\/$/, "");
  const messagesResponse = await fetch(
    `${mirror}/api/v1/topics/${encodeURIComponent(topicId)}/messages?limit=100&order=desc`,
    { cache: "no-store" },
  );
  if (!messagesResponse.ok) throw new Error(`Mirror Node returned HTTP ${messagesResponse.status}`);

  const payload = (await messagesResponse.json()) as MirrorResponse;
  for (const message of payload.messages ?? []) {
    try {
      const decoded = Buffer.from(message.message, "base64").toString("utf8");
      const attestation = JSON.parse(decoded) as ProvenanceAttestation;
      if (
        attestation.schema === PROVENANCE_SCHEMA &&
        attestation.cid === cid &&
        attestation.sha256.toLowerCase() === digest.toLowerCase()
      ) {
        return {
          verified: true,
          cid,
          sha256: digest,
          topicId,
          sequenceNumber: message.sequence_number,
          consensusTimestamp: message.consensus_timestamp,
          attestation,
        };
      }
    } catch {
      // Ignore unrelated/non-JSON messages on the same topic.
    }
  }

  return {
    verified: false,
    cid,
    sha256: digest,
    topicId,
    sequenceNumber: null,
    consensusTimestamp: null,
    attestation: null,
  };
}
