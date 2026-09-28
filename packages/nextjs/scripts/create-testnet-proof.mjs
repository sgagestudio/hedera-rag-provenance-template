import { writeFile } from "node:fs/promises";
import path from "node:path";

import { TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import { create as createIpfsClient } from "kubo-rpc-client";
import { ProvenanceScriptUtils } from "./provenance-script-utils.mjs";

const SCHEMA = "rag-provenance-v1";
const mirrorBase = ProvenanceScriptUtils.parseHttpBase(
  "HEDERA_MIRROR_NODE_URL",
  "https://testnet.mirrornode.hedera.com",
);
const ipfsApi = ProvenanceScriptUtils.parseHttpBase("IPFS_API_URL", "http://127.0.0.1:5001/api/v0");

async function main() {
  const { client, operatorKey } = ProvenanceScriptUtils.createHederaClient();
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
    const added = await ipfs.add(evidence, { pin: true, signal: AbortSignal.timeout(20_000) });
    const cid = added.cid.toString();
    const digest = ProvenanceScriptUtils.sha256Hex(evidence);

    const topic = await ProvenanceScriptUtils.createRestrictedTopic(
      client,
      operatorKey,
      "Scaffold-HBAR RAG provenance bounty proof",
    );

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
      .setTopicId(topic.topicId)
      .setMessage(JSON.stringify(attestation))
      .execute(client);
    const messageReceipt = await messageResponse.getReceipt(client);
    if (messageReceipt.status.toString() !== "SUCCESS") {
      throw new Error(`Hedera message submission returned ${messageReceipt.status.toString()}.`);
    }

    const sequenceNumber = ProvenanceScriptUtils.sequenceNumber(messageReceipt);
    const transactionId = messageResponse.transactionId.toString();
    const mirror = await ProvenanceScriptUtils.waitForMirror({
      mirrorBase,
      topicId: topic.topicId,
      sequenceNumber,
      cid,
      digest,
    });

    const proof = {
      network: "testnet",
      schema: SCHEMA,
      topicId: topic.topicId,
      cid,
      sha256: digest,
      transactionId,
      transactionStatus: messageReceipt.status.toString(),
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
