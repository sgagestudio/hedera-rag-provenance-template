import {
  PROVENANCE_SCHEMA,
  createRestrictedTopic,
  createTestnetClient,
  sha256Hex,
  waitForMirrorMessage,
} from "./provenance-script-utils.mjs";
import { TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { create as createIpfsClient } from "kubo-rpc-client";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const mirrorBase = (process.env.HEDERA_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com").replace(/\/$/, "");
const ipfsApi = process.env.IPFS_API_URL || "http://127.0.0.1:5001/api/v0";

async function main() {
  const { client, operatorPrivateKey } = createTestnetClient();
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

    const topic = await createRestrictedTopic(client, operatorPrivateKey, "Scaffold-HBAR RAG provenance bounty proof");

    const attestation = {
      schema: PROVENANCE_SCHEMA,
      cid,
      sha256: digest,
      sourceUri: "https://github.com/sgagestudio/hedera-rag-provenance-template",
      title: "Scaffold-HBAR RAG Provenance bounty proof",
      mimeType: "text/plain",
      size: evidence.byteLength,
      capturedAt: new Date().toISOString(),
    };

    const messageResponse = await new TopicMessageSubmitTransaction()
      .setTopicId(topic.topicId)
      .setMessage(JSON.stringify(attestation))
      .execute(client);
    const messageReceipt = await messageResponse.getReceipt(client);
    const transactionId = messageResponse.transactionId.toString();
    const transactionStatus = messageReceipt.status.toString();
    if (transactionStatus !== "SUCCESS") {
      throw new Error(`Hedera message transaction finished with status ${transactionStatus}.`);
    }

    const mirror = await waitForMirrorMessage({
      mirrorBase,
      topicId: topic.topicId,
      cid,
      digest,
    });

    const proof = {
      network: "testnet",
      schema: PROVENANCE_SCHEMA,
      topicId: topic.topicId,
      cid,
      sha256: digest,
      transactionId,
      transactionStatus,
      sequenceNumber: mirror.sequenceNumber,
      consensusTimestamp: mirror.consensusTimestamp,
      hashscanTransactionUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(transactionId)}`,
      mirrorNodeMessageUrl: `${mirrorBase}/api/v1/topics/${encodeURIComponent(topic.topicId)}/messages/${mirror.sequenceNumber}`,
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
