import {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
} from "@hiero-ledger/sdk";

const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = process.env.HEDERA_OPERATOR_KEY;

if (!operatorId || !operatorKey) {
  throw new Error("Set HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY before creating a topic.");
}

const client = Client.forTestnet();
const operatorPrivateKey = PrivateKey.fromString(operatorKey);
client.setOperator(AccountId.fromString(operatorId), operatorPrivateKey);

try {
  const tx = await new TopicCreateTransaction()
    .setTopicMemo("Scaffold-HBAR RAG provenance v1")
    .setAdminKey(operatorPrivateKey.publicKey)
    .setSubmitKey(operatorPrivateKey.publicKey)
    .execute(client);
  const receipt = await tx.getReceipt(client);

  if (!receipt.topicId) throw new Error("Hedera did not return a topic ID.");

  console.log(`HEDERA_TOPIC_ID=${receipt.topicId.toString()}`);
  console.log(`Transaction: ${tx.transactionId.toString()}`);
  console.log(`HashScan: https://hashscan.io/testnet/transaction/${encodeURIComponent(tx.transactionId.toString())}`);
} finally {
  client.close();
}
