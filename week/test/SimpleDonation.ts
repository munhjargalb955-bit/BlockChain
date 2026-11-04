import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.create();
const { parseEther } = ethers;

describe("SimpleDonation", () => {
  let simpleDonation;
  let owner, beneficiary, newBeneficiary, donorA, attacker;

  beforeEach(async () => {
    [owner, beneficiary, newBeneficiary, donorA, , attacker] = await ethers.getSigners();
    const SimpleDonation = await ethers.getContractFactory("SimpleDonation");
    simpleDonation = await SimpleDonation.deploy(await beneficiary.getAddress());
    await simpleDonation.waitForDeployment();
  });

  it("배포 시 owner와 beneficiary가 설정되어야 한다", async () => {
    expect(await simpleDonation.owner()).to.equal(await owner.getAddress());
    expect(await simpleDonation.beneficiary()).to.equal(await beneficiary.getAddress());
    expect(await simpleDonation.campaignActive()).to.equal(true);
  });

  it("기부가 누적되어야 한다", async () => {
    await simpleDonation.connect(donorA).donate({ value: parseEther("1") });
    await simpleDonation.connect(donorA).donate({ value: parseEther("0.5") });
    expect(await simpleDonation.donations(donorA)).to.equal(parseEther("1.5"));
    expect(await simpleDonation.totalDonated()).to.equal(parseEther("1.5"));
  });

  it("0 ETH 기부는 실패해야 한다", async () => {
    await expect(simpleDonation.connect(donorA).donate({ value: 0n }))
      .to.be.revertedWith("Donation must be greater than 0");
  });

  it("캠페인이 비활성화되면 기부가 실패해야 한다", async () => {
    await simpleDonation.setCampaignActive(false);
    await expect(simpleDonation.connect(donorA).donate({ value: parseEther("1") }))
      .to.be.revertedWith("Campaign is not active");
  });

  it("beneficiary만 출금할 수 있어야 한다", async () => {
    await simpleDonation.connect(donorA).donate({ value: parseEther("1") });
    await expect(simpleDonation.connect(attacker).withdraw())
      .to.be.revertedWith("Only beneficiary can call this function");
    await simpleDonation.connect(beneficiary).withdraw();
    expect(await simpleDonation.getContractBalance()).to.equal(0n);
  });

  it("잔액이 있으면 beneficiary를 변경할 수 없어야 한다", async () => {
    await simpleDonation.connect(donorA).donate({ value: parseEther("1") });
    await expect(simpleDonation.changeBeneficiary(newBeneficiary))
      .to.be.revertedWith("Contract balance must be zero");
  });
});
