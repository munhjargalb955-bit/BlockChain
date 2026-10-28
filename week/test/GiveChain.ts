import { expect } from "chai";
import hre from "hardhat";

const { ethers } = await hre.network.create();
const { parseEther } = ethers;

describe("GiveChain", () => {
  let giveChain: any;
  let admin: any, beneficiary: any, donorA: any, attacker: any;

  beforeEach(async () => {
    [admin, beneficiary, donorA, , attacker] = await ethers.getSigners();
    giveChain = await ethers.deployContract("GiveChain");
    await giveChain.waitForDeployment();
    await giveChain
      .connect(admin)
      .createCampaign("교육 지원", parseEther("5"), beneficiary.address);
  });

  it("slide 12: donate updates raised", async () => {
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    const campaign = await giveChain.campaigns(0);
    expect(campaign.raised).to.equal(parseEther("1"));
    expect(campaign.stage).to.equal(1n);
  });

  it("slide 13: attacker cannot withdraw", async () => {
    await expect(giveChain.connect(attacker).withdraw(0)).to.be.revert(ethers);
  });

  it("slide 15: 6 fields", async () => {
    const c = await giveChain.campaigns(0);
    expect(c.title).to.equal("교육 지원");
    expect(c.goal).to.equal(parseEther("5"));
    expect(c.raised).to.equal(0n);
    expect(c.beneficiary).to.equal(beneficiary.address);
    expect(c.stage).to.equal(1n);
    expect(c.owner).to.equal(admin.address);
  });

  it("slide 16: ledger consistency", async () => {
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.connect(donorA).donate(0, { value: parseEther("0.5") });
    const c = await giveChain.campaigns(0);
    expect(c.raised).to.equal(parseEther("1.5"));
    expect(await giveChain.donations(0, donorA.address)).to.equal(parseEther("1.5"));
    const addr = await giveChain.getAddress();
    expect(await ethers.provider.getBalance(addr)).to.equal(parseEther("1.5"));
  });

  it("slide 18: SUCCESS state blocks refund", async () => {
    await giveChain.connect(donorA).donate(0, { value: parseEther("5") });
    await giveChain.connect(admin).finalizeCampaign(0);
    const c = await giveChain.campaigns(0);
    expect(c.stage).to.equal(2n);
    await expect(giveChain.connect(donorA).refund(0)).to.be.revert(ethers);
  });

  it("slide 19: Donated event", async () => {
    await expect(
      giveChain.connect(donorA).donate(0, { value: parseEther("1") })
    )
      .to.emit(giveChain, "Donated")
      .withArgs(0n, donorA.address, parseEther("1"));
  });
});