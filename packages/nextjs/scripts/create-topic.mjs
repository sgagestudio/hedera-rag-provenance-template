import { ProvenanceScriptUtils } from "./provenance-script-utils.mjs";

const { client, operatorKey } = ProvenanceScriptUtils.createHederaClient();

try {
  const result = await ProvenanceScriptUtils.createRestrictedTopic(
    client,
    operatorKey,
    "Scaffold-HBAR RAG provenance v1",
  );

  console.log(`HEDERA_TOPIC_ID=${result.topicId}`);
  console.log(`Transaction: ${result.transactionId}`);
  console.log(`HashScan: https://hashscan.io/testnet/transaction/${encodeURIComponent(result.transactionId)}`);
} finally {
  client.close();
}
