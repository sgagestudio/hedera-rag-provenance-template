import { createRestrictedTopic, createTestnetClient } from "./provenance-script-utils.mjs";

const { client, operatorPrivateKey } = createTestnetClient();

try {
  const topic = await createRestrictedTopic(client, operatorPrivateKey, "Scaffold-HBAR RAG provenance v1");

  console.log(`HEDERA_TOPIC_ID=${topic.topicId}`);
  console.log(`Transaction: ${topic.transactionId}`);
  console.log(`HashScan: https://hashscan.io/testnet/transaction/${encodeURIComponent(topic.transactionId)}`);
} finally {
  client.close();
}
