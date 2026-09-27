import { keccak256, toUtf8Bytes } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import type { DeployFunction } from "hardhat-deploy/types";

const SCHEMA_ID = "rag-provenance-v1";

const deployProvenancePolicy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const topicId = process.env.HEDERA_TOPIC_ID || "0.0.0";
  const schemaHash = keccak256(toUtf8Bytes(SCHEMA_ID));

  if (topicId === "0.0.0" && ["hederaTestnet", "hederaMainnet"].includes(hre.network.name)) {
    throw new Error("Set HEDERA_TOPIC_ID before deploying ProvenancePolicy to Hedera.");
  }

  await hre.deployments.deploy("ProvenancePolicy", {
    from: deployer,
    args: [topicId, schemaHash],
    log: true,
    autoMine: true,
  });
};

deployProvenancePolicy.tags = ["ProvenancePolicy"];
export default deployProvenancePolicy;
