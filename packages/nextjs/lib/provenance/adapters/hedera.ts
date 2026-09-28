import { type ProvenanceAttestation, serializeAttestation } from "../domain";
import { ConfigurationError, UpstreamError } from "../errors";
import type { AttestationPublisher, PublishedAttestation } from "../ports";
import { AccountId, Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";

export class HederaHcsPublisher implements AttestationPublisher {
  constructor(
    private readonly topicId: string,
    private readonly operatorId: string,
    private readonly operatorKey: string,
  ) {}

  async publish(attestation: ProvenanceAttestation): Promise<PublishedAttestation> {
    let client: Client | null = null;

    try {
      client = Client.forTestnet();
      client.setOperator(AccountId.fromString(this.operatorId), PrivateKey.fromString(this.operatorKey));

      const response = await new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(this.topicId))
        .setMessage(serializeAttestation(attestation))
        .execute(client);
      const receipt = await response.getReceipt(client);
      if (!receipt.topicSequenceNumber) {
        throw new UpstreamError("Hedera did not return a topic sequence number.");
      }
      const sequenceNumber = Number(receipt.topicSequenceNumber.toString());

      if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber <= 0) {
        throw new UpstreamError("Hedera returned an invalid topic sequence number.");
      }

      return {
        transactionId: response.transactionId.toString(),
        status: receipt.status.toString(),
        sequenceNumber,
      };
    } catch (error) {
      if (error instanceof UpstreamError || error instanceof ConfigurationError) throw error;
      throw new UpstreamError("Hedera HCS submission failed.", { cause: error });
    } finally {
      client?.close();
    }
  }
}
