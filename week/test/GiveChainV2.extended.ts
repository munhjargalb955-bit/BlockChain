import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.create();
const { parseUnits, parseEther, ZeroAddress } = ethers;

const Stage = { NONE: 0n, OPEN: 1n, SUCCESS: 2n, FAILED: 3n };

describe("GiveChainV2 (extended)", () => {
  const GOAL = parseUnits("500", 18);
  let token: any, giveChain: any;
  let owner: any, donor: any, donor2: any, beneficiary: any, stranger: any;
  let tokenAddr: string, chainAddr: string, donorAddr: string, benAddr: string;

  const mintAndApprove = async (who: any, amt: bigint) => {
    await token.mintForCharge(await who.getAddress(), amt);
    await token.connect(who).approve(chainAddr, amt);
  };

  beforeEach(async () => {
    [owner, donor, donor2, beneficiary, stranger] = await ethers.getSigners();
    donorAddr = await donor.getAddress();
    benAddr = await beneficiary.getAddress();

    token = await (await ethers.getContractFactory("GiveTokenV2")).deploy(await owner.getAddress());
    await token.waitForDeployment();
    giveChain = await (await ethers.getContractFactory("GiveChainV2")).deploy();
    await giveChain.waitForDeployment();
    tokenAddr = await token.getAddress();
    chainAddr = await giveChain.getAddress();
  });

  describe("GiveTokenV2", () => {
    it("배포 직후 totalSupply는 0이다", async () => {
      expect(await token.totalSupply()).to.equal(0n);
    });

    it("owner만 mintForCharge 할 수 있고 ChargeMinted를 emit 한다", async () => {
      await expect(token.mintForCharge(donorAddr, 100n))
        .to.emit(token, "ChargeMinted")
        .withArgs(donorAddr, 100n);
      expect(await token.balanceOf(donorAddr)).to.equal(100n);
    });

    it("owner가 아니면 OwnableUnauthorizedAccount로 revert 한다", async () => {
      await expect(token.connect(donor).mintForCharge(donorAddr, 100n))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("0 주소 / 0 금액은 revert 한다", async () => {
      await expect(token.mintForCharge(ZeroAddress, 1n)).to.be.revertedWithCustomError(token, "InvalidUser");
      await expect(token.mintForCharge(donorAddr, 0n)).to.be.revertedWithCustomError(token, "InvalidAmount");
    });
  });

  describe("createCampaign", () => {
    it("토큰 캠페인은 asset이 저장된다", async () => {
      await expect(giveChain.createCampaign("교육 지원", GOAL, benAddr, tokenAddr))
        .to.emit(giveChain, "CampaignCreated");
      const c = await giveChain.campaigns(0);
      expect(c.asset).to.equal(tokenAddr);
      expect(c.stage).to.equal(Stage.OPEN);
    });

    it("ETH 캠페인은 asset == address(0) 이다", async () => {
      await giveChain.createCampaign("ETH", parseEther("1"), benAddr, ZeroAddress);
      expect((await giveChain.campaigns(0)).asset).to.equal(ZeroAddress);
    });

    it("컨트랙트가 아닌 주소를 asset으로 쓰면 InvalidAsset", async () => {
      await expect(giveChain.createCampaign("x", GOAL, benAddr, await stranger.getAddress()))
        .to.be.revertedWithCustomError(giveChain, "InvalidAsset");
    });

    it("goal 0 / beneficiary 0 / non-owner는 revert 한다", async () => {
      await expect(giveChain.createCampaign("x", 0n, benAddr, tokenAddr))
        .to.be.revertedWithCustomError(giveChain, "InvalidGoal");
      await expect(giveChain.createCampaign("x", GOAL, ZeroAddress, tokenAddr))
        .to.be.revertedWithCustomError(giveChain, "InvalidBeneficiary");
      await expect(giveChain.connect(donor).createCampaign("x", GOAL, benAddr, tokenAddr))
        .to.be.revertedWithCustomError(giveChain, "NotOwner");
    });
  });

  describe("donateToken", () => {
    beforeEach(async () => {
      await giveChain.createCampaign("교육 지원", GOAL, benAddr, tokenAddr);
    });

    it("approve 없이 기부하면 revert 한다", async () => {
      await token.mintForCharge(donorAddr, 100n);
      await expect(giveChain.connect(donor).donateToken(0, 100n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("approve 후 기부하면 donations, raised, 실제 잔액, lifetime이 모두 갱신된다", async () => {
      const amt = parseUnits("100", 18);
      await mintAndApprove(donor, amt);

      await expect(giveChain.connect(donor).donateToken(0, amt))
        .to.emit(giveChain, "Donated")
        .withArgs(0n, donorAddr, tokenAddr, amt);

      expect(await giveChain.donations(0, donorAddr)).to.equal(amt);
      expect((await giveChain.campaigns(0)).raised).to.equal(amt);
      expect(await token.balanceOf(chainAddr)).to.equal(amt);
      expect(await token.balanceOf(donorAddr)).to.equal(0n);
      expect(await giveChain.lifetimeDonatedByAsset(tokenAddr)).to.equal(amt);
      expect(await giveChain.getContractAssetBalance(tokenAddr)).to.equal(amt);
      expect(await token.allowance(donorAddr, chainAddr)).to.equal(0n);
    });

    it("allowance보다 많이 기부하면 revert 한다", async () => {
      await mintAndApprove(donor, 100n);
      await token.mintForCharge(donorAddr, 100n);
      await expect(giveChain.connect(donor).donateToken(0, 150n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("0 금액은 InvalidDonation", async () => {
      await expect(giveChain.connect(donor).donateToken(0, 0n))
        .to.be.revertedWithCustomError(giveChain, "InvalidAmount");
    });

    it("ETH를 보내는 donateETH는 토큰 캠페인에서 WrongAssetType", async () => {
      await expect(giveChain.connect(donor).donateETH(0, { value: 1n }))
        .to.be.revertedWithCustomError(giveChain, "WrongAssetType");
    });

    it("존재하지 않는 캠페인은 InvalidCampaign", async () => {
      await expect(giveChain.connect(donor).donateToken(9, 1n))
        .to.be.revertedWithCustomError(giveChain, "CampaignNotFound");
    });

    it("finalize 이후에는 InvalidStage", async () => {
      await mintAndApprove(donor, 100n);
      await giveChain.finalizeCampaign(0);
      await expect(giveChain.connect(donor).donateToken(0, 100n))
        .to.be.revertedWithCustomError(giveChain, "InvalidStage");
    });

    it("수수료 토큰은 요청액이 아니라 실제 수령액(98%)을 기록한다", async () => {
      const fee = await (await ethers.getContractFactory("FeeToken")).deploy();
      await fee.waitForDeployment();
      const feeAddr = await fee.getAddress();
      await giveChain.createCampaign("fee", GOAL, benAddr, feeAddr); // id 1

      await fee.mint(donorAddr, 1000n);
      await fee.connect(donor).approve(chainAddr, 1000n);
      await giveChain.connect(donor).donateToken(1, 1000n);

      expect(await fee.balanceOf(chainAddr)).to.equal(980n);
      expect(await giveChain.donations(1, donorAddr)).to.equal(980n);
      expect((await giveChain.campaigns(1)).raised).to.equal(980n);
    });
  });

  describe("donateETH (V1 동작 유지)", () => {
    beforeEach(async () => {
      await giveChain.createCampaign("ETH", parseEther("1"), benAddr, ZeroAddress);
    });

    it("ETH 기부가 기록된다", async () => {
      await expect(giveChain.connect(donor).donateETH(0, { value: parseEther("1") }))
        .to.emit(giveChain, "Donated")
        .withArgs(0n, donorAddr, ZeroAddress, parseEther("1"));
      expect(await giveChain.donations(0, donorAddr)).to.equal(parseEther("1"));
      expect(await giveChain.getContractAssetBalance(ZeroAddress)).to.equal(parseEther("1"));
    });

    it("0 ETH는 InvalidDonation", async () => {
      await expect(giveChain.connect(donor).donateETH(0, { value: 0n }))
        .to.be.revertedWithCustomError(giveChain, "InvalidAmount");
    });

    it("ETH 캠페인에 donateToken은 WrongAssetType", async () => {
      await expect(giveChain.connect(donor).donateToken(0, 1n))
        .to.be.revertedWithCustomError(giveChain, "WrongAssetType");
    });

    it("SUCCESS 후 beneficiary가 ETH를 출금한다", async () => {
      await giveChain.connect(donor).donateETH(0, { value: parseEther("1") });
      await giveChain.finalizeCampaign(0);
      await expect(giveChain.connect(beneficiary).withdraw(0))
        .to.changeEtherBalances(ethers, [giveChain, beneficiary], [-parseEther("1"), parseEther("1")]);
    });

    it("FAILED 후 donor가 ETH를 환불받는다", async () => {
      await giveChain.connect(donor).donateETH(0, { value: parseEther("0.4") });
      await giveChain.finalizeCampaign(0);
      await expect(giveChain.connect(donor).refund(0))
        .to.changeEtherBalances(ethers, [giveChain, donor], [-parseEther("0.4"), parseEther("0.4")]);
    });
  });

  describe("finalize / withdraw (SUCCESS)", () => {
    const donation = parseUnits("600", 18);

    beforeEach(async () => {
      await giveChain.createCampaign("교육 지원", GOAL, benAddr, tokenAddr);
      await mintAndApprove(donor, donation);
      await giveChain.connect(donor).donateToken(0, donation);
    });

    it("raised >= goal 이면 SUCCESS", async () => {
      await giveChain.finalizeCampaign(0);
      expect((await giveChain.campaigns(0)).stage).to.equal(Stage.SUCCESS);
    });

    it("non-owner는 finalize 할 수 없다", async () => {
      await expect(giveChain.connect(donor).finalizeCampaign(0))
        .to.be.revertedWithCustomError(giveChain, "NotOwner");
    });

    it("beneficiary가 withdraw 하면 GVT가 이동하고 Withdrawn을 emit 한다", async () => {
      await giveChain.finalizeCampaign(0);
      await expect(giveChain.connect(beneficiary).withdraw(0))
        .to.emit(giveChain, "Withdrawn")
        .withArgs(0n, benAddr, tokenAddr, donation);
      expect(await token.balanceOf(benAddr)).to.equal(donation);
      expect(await token.balanceOf(chainAddr)).to.equal(0n);
    });

    it("중복 withdraw는 AlreadyWithdrawn", async () => {
      await giveChain.finalizeCampaign(0);
      await giveChain.connect(beneficiary).withdraw(0);
      await expect(giveChain.connect(beneficiary).withdraw(0))
        .to.be.revertedWithCustomError(giveChain, "AlreadyWithdrawn");
    });

    it("beneficiary가 아니면 OnlyBeneficiary", async () => {
      await giveChain.finalizeCampaign(0);
      await expect(giveChain.connect(stranger).withdraw(0))
        .to.be.revertedWithCustomError(giveChain, "NotBeneficiary");
    });

    it("SUCCESS 전(OPEN)에는 withdraw/refund가 InvalidStage", async () => {
      await expect(giveChain.connect(beneficiary).withdraw(0))
        .to.be.revertedWithCustomError(giveChain, "InvalidStage");
      await expect(giveChain.connect(donor).refund(0))
        .to.be.revertedWithCustomError(giveChain, "InvalidStage");
    });

    it("SUCCESS 캠페인은 refund 할 수 없다", async () => {
      await giveChain.finalizeCampaign(0);
      await expect(giveChain.connect(donor).refund(0))
        .to.be.revertedWithCustomError(giveChain, "InvalidStage");
    });
  });

  describe("refund (FAILED)", () => {
    beforeEach(async () => {
      await giveChain.createCampaign("동물 보호", GOAL, benAddr, tokenAddr);
      await mintAndApprove(donor, 100n);
      await giveChain.connect(donor).donateToken(0, 100n);
      await giveChain.finalizeCampaign(0);
    });

    it("raised < goal 이면 FAILED", async () => {
      expect((await giveChain.campaigns(0)).stage).to.equal(Stage.FAILED);
    });

    it("donor가 본인 기부액을 환불받는다", async () => {
      await expect(giveChain.connect(donor).refund(0))
        .to.emit(giveChain, "Refunded")
        .withArgs(0n, donorAddr, tokenAddr, 100n);
      expect(await token.balanceOf(donorAddr)).to.equal(100n);
      expect(await giveChain.donations(0, donorAddr)).to.equal(0n);
      expect((await giveChain.campaigns(0)).refunded).to.equal(100n);
      expect(await token.balanceOf(chainAddr)).to.equal(0n);
    });

    it("중복 환불은 NoDonation", async () => {
      await giveChain.connect(donor).refund(0);
      await expect(giveChain.connect(donor).refund(0))
        .to.be.revertedWithCustomError(giveChain, "NothingToRefund");
    });

    it("기부하지 않은 계정은 NoDonation", async () => {
      await expect(giveChain.connect(stranger).refund(0))
        .to.be.revertedWithCustomError(giveChain, "NothingToRefund");
    });

    it("FAILED 캠페인은 withdraw 할 수 없다", async () => {
      await expect(giveChain.connect(beneficiary).withdraw(0))
        .to.be.revertedWithCustomError(giveChain, "InvalidStage");
    });

    it("refund해도 lifetimeDonatedByAsset은 감소하지 않는다", async () => {
      await giveChain.connect(donor).refund(0);
      expect(await giveChain.lifetimeDonatedByAsset(tokenAddr)).to.equal(100n);
    });
  });

  describe("캠페인별 회계 분리", () => {
    it("한 캠페인 정산이 다른 캠페인의 토큰을 건드리지 않는다", async () => {
      await giveChain.createCampaign("A", 500n, benAddr, tokenAddr); // 0: SUCCESS
      await giveChain.createCampaign("B", 500n, benAddr, tokenAddr); // 1: FAILED

      await mintAndApprove(donor, 700n);
      await giveChain.connect(donor).donateToken(0, 600n);
      await giveChain.connect(donor).donateToken(1, 100n);

      await giveChain.finalizeCampaign(0);
      await giveChain.finalizeCampaign(1);

      await giveChain.connect(beneficiary).withdraw(0);
      expect(await token.balanceOf(benAddr)).to.equal(600n);
      expect(await token.balanceOf(chainAddr)).to.equal(100n); // B의 몫은 그대로

      await giveChain.connect(donor).refund(1);
      expect(await token.balanceOf(donorAddr)).to.equal(100n);
      expect(await token.balanceOf(chainAddr)).to.equal(0n);
    });

    it("여러 donor의 환불은 각자 본인 몫만 받는다", async () => {
      await giveChain.createCampaign("B", GOAL, benAddr, tokenAddr);
      await mintAndApprove(donor, 100n);
      await mintAndApprove(donor2, 40n);
      await giveChain.connect(donor).donateToken(0, 100n);
      await giveChain.connect(donor2).donateToken(0, 40n);
      await giveChain.finalizeCampaign(0);

      await giveChain.connect(donor2).refund(0);
      expect(await token.balanceOf(await donor2.getAddress())).to.equal(40n);
      expect(await token.balanceOf(chainAddr)).to.equal(100n);
    });
  });

  describe("changeBeneficiary", () => {
    beforeEach(async () => {
      await giveChain.createCampaign("A", GOAL, benAddr, tokenAddr);
    });

    it("기부 전에는 변경 가능", async () => {
      const newBen = await stranger.getAddress();
      await expect(giveChain.changeBeneficiary(0, newBen))
        .to.emit(giveChain, "BeneficiaryChanged")
        .withArgs(0n, benAddr, newBen);
    });

    it("기부 후에는 CampaignHasDonation", async () => {
      await mintAndApprove(donor, 10n);
      await giveChain.connect(donor).donateToken(0, 10n);
      await expect(giveChain.changeBeneficiary(0, await stranger.getAddress()))
        .to.be.revertedWithCustomError(giveChain, "CampaignAlreadyFunded");
    });
  });
});
