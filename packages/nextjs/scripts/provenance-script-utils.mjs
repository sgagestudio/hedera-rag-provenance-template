import { AccountId, Client, PrivateKey, TopicCreateTransaction } from "@hiero-ledger/sdk";
import crypto from "node:crypto";

export class ProvenanceScriptUtils {
  static required(name) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  }

  static sha256Hex(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }

  static parseHttpBase(name, fallback) {
    const raw = process.env[name]?.trim() || fallback;
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`${name} must use http or https.`);
    }
    if (url.username || url.password) {
      throw new Error(`${name} must not contain embedded credentials.`);
    }
    return url.toString().replace(/\/$/, "");
  }

  static createHederaClient() {
    const operatorId = AccountId.fromString(this.required("HEDERA_OPERATOR_ID"));
    const operatorKey = PrivateKey.fromString(this.required("HEDERA_OPERATOR_KEY"));
    const client = Client.forTestnet();
    client.setOperator(operatorId, operatorKey);
    return { client, operatorKey };
  }

  static async createRestrictedTopic(client, operatorKey, memo) {
    const response = await new TopicCreateTransaction()
      .setTopicMemo(memo)
      .setAdminKey(operatorKey.publicKey)
      .setSubmitKey(operatorKey.publicKey)
      .execute(client);
    const receipt = await response.getReceipt(client);
    if (!receipt.topicId) throw new Error("Hedera did not return a topic ID.");
    return {
      topicId: receipt.topicId.toString(),
      transactionId: response.transactionId.toString(),
    };
  }

  static sequenceNumber(receipt) {
    if (!receipt.topicSequenceNumber) {
      throw new Error("Hedera did not return a topic sequence number.");
    }
    const sequenceNumber = Number(receipt.topicSequenceNumber.toString());
    if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber <= 0) {
      throw new Error("Hedera did not return a valid topic sequence number.");
    }
    return sequenceNumber;
  }

  static async waitForMirror({ mirrorBase, topicId, sequenceNumber, cid, digest, timeoutMs = 60_000 }) {
    const deadline = Date.now() + timeoutMs;
    let delayMs = 1_500;

    while (Date.now() < deadline) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(10_000, Math.max(1_000, deadline - Date.now())));

      try {
        const response = await fetch(
          `${mirrorBase}/api/v1/topics/${encodeURIComponent(topicId)}/messages/${sequenceNumber}`,
          { cache: "no-store", signal: controller.signal },
        );

        if (response.ok) {
          const payload = await response.json();
          const message = payload.messages?.[0];
          if (message?.message) {
            try {
              const attestation = JSON.parse(Buffer.from(message.message, "base64").toString("utf8"));
              if (
                attestation.schema === "rag-provenance-v1" &&
                attestation.cid === cid &&
                attestation.sha256 === digest
              ) {
                return {
                  sequenceNumber: Number(message.sequence_number),
                  consensusTimestamp: message.consensus_timestamp,
                };
              }
            } catch {
              // The exact sequence exists but is not the expected provenance message yet.
            }
          }
        } else if (response.status !== 404 && response.status < 500) {
          throw new Error(`Mirror Node returned HTTP ${response.status}.`);
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          const message = error instanceof Error ? error.message : String(error);
          if (message.startsWith("Mirror Node returned HTTP")) throw error;
          if (Date.now() + delayMs >= deadline) throw error;
        }
      } finally {
        clearTimeout(timer);
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs = Math.min(Math.ceil(delayMs * 1.6), 6_000);
    }

    throw new Error("Mirror Node did not expose the provenance message before the timeout.");
  }
}
