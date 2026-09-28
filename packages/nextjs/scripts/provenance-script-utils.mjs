import crypto from "node:crypto";

import {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
} from "@hiero-ledger/sdk";

export const PROVENANCE_SCHEMA = "rag-provenance-v1";

export function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function createTestnetClient() {
  const operatorId = AccountId.fromString(requiredEnv("HEDERA_OPERATOR_ID"));
  const operatorPrivateKey = PrivateKey.fromString(requiredEnv("HEDERA_OPERATOR_KEY"));
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorPrivateKey);
  return { client, operatorPrivateKey };
}

export async function createRestrictedTopic(client, operatorPrivateKey, memo) {
  const response = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setAdminKey(operatorPrivateKey.publicKey)
    .setSubmitKey(operatorPrivateKey.publicKey)
    .execute(client);
  const receipt = await response.getReceipt(client);
  if (!receipt.topicId) throw new Error("Hedera did not return a topic ID.");
  return {
    topicId: receipt.topicId.toString(),
    transactionId: response.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

async function fetchJsonWithTimeout(url, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForMirrorMessage({
  mirrorBase,
  topicId,
  cid,
  digest,
  timeoutMs = 45_000,
}) {
  const deadline = Date.now() + timeoutMs;
  const normalizedBase = mirrorBase.replace(/\/$/, "");

  while (Date.now() < deadline) {
    const payload = await fetchJsonWithTimeout(
      `${normalizedBase}/api/v1/topics/${encodeURIComponent(topicId)}/messages?limit=25&order=desc`,
    );

    for (const message of payload?.messages ?? []) {
      try {
        const decoded = Buffer.from(message.message, "base64").toString("utf8");
        const attestation = JSON.parse(decoded);
        if (
          attestation.schema === PROVENANCE_SCHEMA &&
          attestation.cid === cid &&
          attestation.sha256 === digest
        ) {
          return {
            sequenceNumber: message.sequence_number,
            consensusTimestamp: message.consensus_timestamp,
          };
        }
      } catch {
        // Ignore unrelated or malformed messages.
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2_000));
  }

  throw new Error("Mirror Node did not expose the provenance message within 45 seconds.");
}
