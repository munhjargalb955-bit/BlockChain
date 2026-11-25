import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("GiveChainV2", function () {
  let token: any;
  let giveChain: any;
  let owner: any;
  let donor: any;
  let beneficiary: any;

  beforeEach(async function () {
    [owner, donor, beneficiary] = await ethers.getSigners();

    const ownerAddress = await owner.getAddress();

    token = await ethers.deployContract(
      "GiveTokenV2",
      [ownerAddress]
    );
    await token.waitForDeployment();

    giveChain = await ethers.deployContract("GiveChainV2");
    await giveChain.waitForDeployment();
  });

  it("owner만 GVT를 mint할 수 있다", async function () {
    const donorAddress = await donor.getAddress();
    const amount = ethers.parseUnits("1000", 18);

    await token.mintForCharge(donorAddress, amount);

    expect(
      await token.balanceOf(donorAddress)
    ).to.equal(amount);

    await expect(
      token.connect(donor).mintForCharge(donorAddress, amount)
    ).to.be.revert(ethers);
  });

  it("approve 없이 GVT 기부를 할 수 없다", async function () {
    const donorAddress = await donor.getAddress();
    const beneficiaryAddress = await beneficiary.getAddress();
    const tokenAddress = await token.getAddress();
    const giveChainAddress = await giveChain.getAddress();

    const goal = ethers.parseUnits("500", 18);
    const amount = ethers.parseUnits("100", 18);

    await token.mintForCharge(donorAddress, amount);

    await giveChain.createCampaign(
      "GVT Campaign",
      goal,
      beneficiaryAddress,
      tokenAddress
    );

    expect(
      await token.allowance(donorAddress, giveChainAddress)
    ).to.equal(0n);

    await expect(
      giveChain.connect(donor).donateToken(0, amount)
    ).to.be.revert(ethers);
  });

  it("approve 후 GVT 기부 기록이 저장된다", async function () {
    const donorAddress = await donor.getAddress();
    const beneficiaryAddress = await beneficiary.getAddress();
    const tokenAddress = await token.getAddress();
    const giveChainAddress = await giveChain.getAddress();

    const goal = ethers.parseUnits("500", 18);
    const amount = ethers.parseUnits("100", 18);

    await token.mintForCharge(donorAddress, amount);

    await giveChain.createCampaign(
      "GVT Campaign",
      goal,
      beneficiaryAddress,
      tokenAddress
    );

    await token.connect(donor).approve(giveChainAddress, amount);

    await expect(
      giveChain.connect(donor).donateToken(0, amount)
    )
      .to.emit(giveChain, "Donated")
      .withArgs(
        0,
        donorAddress,
        tokenAddress,
        amount
      );

    const campaign = await giveChain.campaigns(0);

    expect(campaign.raised).to.equal(amount);
    expect(
      await giveChain.donations(0, donorAddress)
    ).to.equal(amount);
  });

  it("ETH 기부도 raised와 donations에 동일하게 기록된다", async function () {
    const donorAddress = await donor.getAddress();
    const beneficiaryAddress = await beneficiary.getAddress();

    const goal = ethers.parseEther("1");
    const amount = ethers.parseEther("0.2");

    await giveChain.createCampaign(
      "ETH Campaign",
      goal,
      beneficiaryAddress,
      ethers.ZeroAddress
    );

    await expect(
      giveChain.connect(donor).donateETH(
        0,
        { value: amount }
      )
    )
      .to.emit(giveChain, "Donated")
      .withArgs(
        0,
        donorAddress,
        ethers.ZeroAddress,
        amount
      );

    const campaign = await giveChain.campaigns(0);

    expect(campaign.raised).to.equal(amount);
    expect(
      await giveChain.donations(0, donorAddress)
    ).to.equal(amount);
  });
});
