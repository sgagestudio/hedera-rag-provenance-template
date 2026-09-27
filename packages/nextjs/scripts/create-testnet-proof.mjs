import crypto from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hiero-ledger/sdk";
import { create as createIpfsClient } from "kubo-rpc-client";

const SCHEMA = "rag-provenance-v1";
const mirrorBase = (process.env.HEDERA_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com").replace(/\/$/, "");
const ipfsApi = process.env.IPFS_API_URL || "http://127.0.0.1:5001/api/v0";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function waitForMirror(topicId, cid, digest, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(
      `${mirrorBase}/api/v1/topics/${encodeURIComponent(topicId)}/messages?limit=25&order=desc`,
      { cache: "no-store" },
    );

    if (response.ok) {
      const payload = await response.json();
      for (const message of payload.messages ?? []) {
        try {
          const decoded = Buffer.from(message.message, "base64").toString("utf8");
          const attestation = JSON.parse(decoded);
          if (attestation.schema === SCHEMA && attestation.cid === cid && attestation.sha256 === digest) {
            return {
              sequenceNumber: message.sequence_number,
              consensusTimestamp: message.consensus_timestamp,
            };
          }
        } catch {
          // Ignore unrelated messages.
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2_000));
  }

  throw new Error("Mirror Node did not expose the provenance message within 45 seconds.");
}

async function main() {
  const operatorId = AccountId.fromString(required("HEDERA_OPERATOR_ID"));
  const operatorKey = PrivateKey.fromString(required("HEDERA_OPERATOR_KEY"));

  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);

  const ipfs = createIpfsClient({ url: ipfsApi });

  const evidence = Buffer.from(
    [
      "Scaffold-HBAR RAG Provenance Template",
      "Public testnet proof for verifiable AI/RAG source provenance.",
      "Repository: https://github.com/sgagestudio/hedera-rag-provenance-template",
      "",
    ].join("\n"),
    "utf8",
  );

  try {
    const added = await ipfs.add(evidence, { pin: true });
    const cid = added.cid.toString();
    const digest = sha256Hex(evidence);

    const topicResponse = await new TopicCreateTransaction()
      .setTopicMemo("Scaffold-HBAR RAG provenance bounty proof")
      .setAdminKey(operatorKey.publicKey)
      .setSubmitKey(operatorKey.publicKey)
      .execute(client);
    const topicReceipt = await topicResponse.getReceipt(client);
    if (!topicReceipt.topicId) throw new Error("Hedera did not return a topic ID.");
    const topicId = topicReceipt.topicId.toString();

    const attestation = {
      schema: SCHEMA,
      cid,
      sha256: digest,
      sourceUri: "https://github.com/sgagestudio/hedera-rag-provenance-template",
      title: "Scaffold-HBAR RAG Provenance bounty proof",
      mimeType: "text/plain",
      size: evidence.byteLength,
      capturedAt: new Date().toISOString(),
    };

    const messageResponse = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(attestation))
      .execute(client);
    const messageReceipt = await messageResponse.getReceipt(client);

    const transactionId = messageResponse.transactionId.toString();
    const mirror = await waitForMirror(topicId, cid, digest);

    const proof = {
      network: "testnet",
      schema: SCHEMA,
      topicId,
      cid,
      sha256: digest,
      transactionId,
      transactionStatus: messageReceipt.status.toString(),
      sequenceNumber: mirror.sequenceNumber,
      consensusTimestamp: mirror.consensusTimestamp,
      hashscanTransactionUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(transactionId)}`,
      mirrorNodeMessageUrl: `${mirrorBase}/api/v1/topics/${encodeURIComponent(topicId)}/messages/${mirror.sequenceNumber}`,
      repository: "https://github.com/sgagestudio/hedera-rag-provenance-template",
    };

    if (process.argv.includes("--write-proof")) {
      const output = path.resolve(process.cwd(), "../../proofs/testnet-proof.json");
      await writeFile(output, JSON.stringify(proof, null, 2) + "\n", "utf8");
    }

    console.log(JSON.stringify(proof, null, 2));
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
