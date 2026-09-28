import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";

import type { ProvenanceAttestation } from "./core";
import { getHederaOperator } from "./config";
import { ExternalServiceError } from "./http";

export async function submitAttestation(
  topicId: string,
  attestation: ProvenanceAttestation,
): Promise<{ transactionId: string; status: string }> {
  const operator = getHederaOperator();
  const client = Client.forTestnet();

  try {
    client.setOperator(AccountId.fromString(operator.accountId), PrivateKey.fromString(operator.privateKey));
    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(JSON.stringify(attestation))
      .execute(client);
    const receipt = await response.getReceipt(client);
    const status = receipt.status.toString();
    if (status !== "SUCCESS") {
      throw new ExternalServiceError("Hedera", `Hedera transaction returned ${status}`);
    }
    return { transactionId: response.transactionId.toString(), status };
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error;
    throw new ExternalServiceError("Hedera", "Hedera attestation submission failed");
  } finally {
    client.close();
  }
}
