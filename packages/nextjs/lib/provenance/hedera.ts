import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";

import { getProvenanceConfig, requiredEnv } from "./config";
import { ProvenanceAttestation, serializeAttestation } from "./domain";
import { configurationError, upstreamError } from "./errors";

function createHederaClient(): Client {
  try {
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(requiredEnv("HEDERA_OPERATOR_ID")),
      PrivateKey.fromString(requiredEnv("HEDERA_OPERATOR_KEY")),
    );
    return client;
  } catch (cause) {
    throw configurationError("Hedera operator configuration is invalid.", cause);
  }
}

export async function submitAttestationToHedera(attestation: ProvenanceAttestation): Promise<{
  topicId: string;
  transactionId: string;
  status: string;
}> {
  const config = getProvenanceConfig();
  const client = createHederaClient();

  try {
    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(config.topicId))
      .setMessage(serializeAttestation(attestation))
      .execute(client);
    const receipt = await response.getReceipt(client);
    const status = receipt.status.toString();

    if (status !== "SUCCESS") throw upstreamError(`Hedera transaction finished with status ${status}.`);

    return {
      topicId: config.topicId,
      transactionId: response.transactionId.toString(),
      status,
    };
  } catch (cause) {
    if (cause instanceof Error && cause.name === "ProvenanceError") throw cause;
    throw upstreamError("Hedera attestation submission failed.", cause);
  } finally {
    client.close();
  }
}
