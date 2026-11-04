import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.create();
const { parseEther } = ethers;

describe("GiveChain", () => {
  let giveChain;
  let owner, beneficiaryA, beneficiaryB,
    donorA, donorB, attacker;

  beforeEach(async () => {
    [owner, beneficiaryA, beneficiaryB,
      donorA, donorB, attacker]
      = await ethers.getSigners();
    const GiveChain = await
      ethers.getContractFactory("GiveChain");
    giveChain = await GiveChain.deploy();
    await giveChain.waitForDeployment();
  });

  // ---- 01 · owner / 02 · campaignCount ----
  it("배포자가 GiveChain owner로 설정되어야 한다", async () => {
    expect(await giveChain.owner())
      .to.equal(await owner.getAddress());
  });

  it("배포 직후 campaignCount는 0 이어야 한다", async () => {
    expect(await giveChain.campaignCount())
      .to.equal(0n);
  });

  // ---- 03 · createCampaign 6 fields ----
  it("새 캠페인을 생성하면 정보가 정확하게 저장되어야 한다", async () => {
    await giveChain.createCampaign(
      "교육 지원",
      parseEther("5"),
      await beneficiaryA.getAddress());
    const c = await giveChain.campaigns(0);
    expect(c.owner).to.equal(owner);
    expect(c.title).to.equal("교육 지원");
    expect(c.goal).to.equal(parseEther("5"));
    expect(c.raised).to.equal(0n);
    expect(c.beneficiary).to.equal(beneficiaryA);
    expect(c.stage).to.equal(1n); // OPEN
    expect(await giveChain.campaignCount())
      .to.equal(1n);
  });

  // ---- 04 · multi campaign ----
  it("여러 캠페인이 서로 독립적으로 저장되어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await giveChain.createCampaign("의료 지원", parseEther("3"), beneficiaryB);
    const c0 = await giveChain.campaigns(0);
    const c1 = await giveChain.campaigns(1);
    expect(c0.title).to.equal("교육 지원");
    expect(c1.title).to.equal("의료 지원");
    expect(c0.goal).to.equal(parseEther("5"));
    expect(c1.goal).to.equal(parseEther("3"));
    expect(c0.beneficiary).to.equal(beneficiaryA);
    expect(c1.beneficiary).to.equal(beneficiaryB);
  });

  // ---- 05 · repeated donation ----
  it("같은 기부자의 반복 기부가 누적되어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.connect(donorA).donate(0, { value: parseEther("0.5") });
    const c = await giveChain.campaigns(0);
    expect(c.raised).to.equal(parseEther("1.5"));
    expect(await giveChain.donations(0, donorA)).to.equal(parseEther("1.5"));
    expect(await giveChain.totalDonated()).to.equal(parseEther("1.5"));
  });

  // ---- 06 · zero donation ----
  it("0 ETH 기부는 실패해야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await expect(giveChain.connect(donorA).donate(0, { value: 0n }))
      .to.be.revertedWithCustomError(giveChain, "InvalidDonation");
  });

  // ---- 07 · SUCCESS ----
  it("목표 금액 이상 모금되면 SUCCESS가 되어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("1"), beneficiaryA);
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.finalizeCampaign(0);
    const c = await giveChain.campaigns(0);
    expect(c.stage).to.equal(2n);
  });

  // ---- 08 · FAILED ----
  it("목표 금액 미달이면 FAILED가 되어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.finalizeCampaign(0);
    const c = await giveChain.campaigns(0);
    expect(c.stage).to.equal(3n);
  });

  // ---- 09 · non owner finalize ----
  it("owner가 아닌 계정은 캠페인을 finalize할 수 없어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await expect(giveChain.connect(donorA).finalizeCampaign(0))
      .to.be.revertedWithCustomError(giveChain, "OnlyOwner");
  });

  // ---- 10 · non beneficiary withdraw ----
  it("beneficiary가 아닌 계정은 SUCCESS 캠페인을 출금할 수 없어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("1"), beneficiaryA);
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.finalizeCampaign(0);
    await expect(giveChain.connect(attacker).withdraw(0))
      .to.be.revertedWithCustomError(giveChain, "OnlyBeneficiary");
  });

  // ---- 11 · 한 캠페인이 다른 캠페인의 ETH 가져가지 않음 ----
  it("한 캠페인의 출금이 다른 캠페인의 ETH까지 가져가서는 안 된다", async () => {
    await giveChain.createCampaign("교육", parseEther("1"), beneficiaryA);
    await giveChain.createCampaign("의료", parseEther("2"), beneficiaryB);
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.connect(donorB).donate(1, { value: parseEther("2") });
    await giveChain.finalizeCampaign(0);
    await giveChain.connect(beneficiaryA).withdraw(0);
    expect(await ethers.provider.getBalance(
      await giveChain.getAddress()
    )).to.equal(parseEther("2"));
  });

  // ---- 12·13 · 환불 + 중복 환불 차단 ----
  it("FAILED 캠페인은 기부자가 환불받을 수 있어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.finalizeCampaign(0); // FAILED
    await giveChain.connect(donorA).refund(0);
    expect(await giveChain.donations(0, donorA))
      .to.equal(0n);
  });

  it("같은 기부금을 두 번 환불받을 수 없어야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await giveChain.connect(donorA).donate(0, { value: parseEther("1") });
    await giveChain.finalizeCampaign(0); // FAILED
    await giveChain.connect(donorA).refund(0);
    await expect(giveChain.connect(donorA).refund(0))
      .to.be.revertedWithCustomError(giveChain, "NoDonation");
  });

  // ---- 14 · Donated event / withArgs ----
  it("기부 시 Donated 이벤트가 정확한 값으로 발생해야 한다", async () => {
    await giveChain.createCampaign("교육 지원", parseEther("5"), beneficiaryA);
    await expect(
      giveChain.connect(donorA).donate(0, { value: parseEther("1") })
    ).to.emit(giveChain, "Donated").withArgs(
      0n, donorA, parseEther("1")
    );
  });
});
