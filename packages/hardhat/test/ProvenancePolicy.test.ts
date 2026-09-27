import { expect } from "chai";
import { deployments, ethers } from "hardhat";

describe("ProvenancePolicy", function () {
  async function fixture() {
    await deployments.fixture(["ProvenancePolicy"]);
    const [owner, other] = await ethers.getSigners();
    const deployment = await deployments.get("ProvenancePolicy");
    const policy = await ethers.getContractAt("ProvenancePolicy", deployment.address, owner);
    return { policy, owner, other };
  }

  it("anchors a topic and non-zero schema hash", async function () {
    const { policy } = await fixture();

    expect(await policy.topicId()).to.equal("0.0.0");
    expect(await policy.schemaHash()).to.not.equal(ethers.ZeroHash);
  });

  it("allows only the owner to update the discovery policy", async function () {
    const { policy, other } = await fixture();
    const nextSchema = ethers.keccak256(ethers.toUtf8Bytes("rag-provenance-v2"));

    await expect(policy.connect(other).setPolicy("0.0.123", nextSchema))
      .to.be.revertedWithCustomError(policy, "OwnableUnauthorizedAccount")
      .withArgs(other.address);

    await expect(policy.setPolicy("0.0.123", nextSchema))
      .to.emit(policy, "PolicyUpdated")
      .withArgs("0.0.123", nextSchema);

    expect(await policy.topicId()).to.equal("0.0.123");
    expect(await policy.schemaHash()).to.equal(nextSchema);
  });

  it("rejects an empty topic or empty schema hash", async function () {
    const { policy } = await fixture();
    const schema = ethers.keccak256(ethers.toUtf8Bytes("schema"));

    await expect(policy.setPolicy("", schema)).to.be.revertedWithCustomError(policy, "EmptyTopicId");
    await expect(policy.setPolicy("0.0.123", ethers.ZeroHash)).to.be.revertedWithCustomError(policy, "EmptySchemaHash");
  });
});
