// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ProvenancePolicy
 * @notice Small on-chain discovery anchor for a RAG provenance deployment.
 *
 * Evidence bytes live in decentralized storage and evidence attestations live in
 * Hedera Consensus Service. This contract deliberately stores neither. It gives
 * downstream applications one EVM address from which they can discover the
 * canonical HCS topic and the schema hash that messages on that topic must use.
 */
contract ProvenancePolicy is Ownable {
    string public topicId;
    bytes32 public schemaHash;

    event PolicyUpdated(string topicId, bytes32 schemaHash);

    error EmptyTopicId();
    error EmptySchemaHash();

    constructor(string memory topicId_, bytes32 schemaHash_) Ownable(msg.sender) {
        _setPolicy(topicId_, schemaHash_);
    }

    function setPolicy(string calldata topicId_, bytes32 schemaHash_) external onlyOwner {
        _setPolicy(topicId_, schemaHash_);
    }

    function _setPolicy(string memory topicId_, bytes32 schemaHash_) private {
        if (bytes(topicId_).length == 0) revert EmptyTopicId();
        if (schemaHash_ == bytes32(0)) revert EmptySchemaHash();

        topicId = topicId_;
        schemaHash = schemaHash_;
        emit PolicyUpdated(topicId_, schemaHash_);
    }
}
