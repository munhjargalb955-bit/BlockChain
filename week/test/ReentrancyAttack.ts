import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.create();
const { parseEther } = ethers;

describe("ReentrancyAttack", () => {
  let giveChain;
  let refundAttacker;
  let owner, beneficiaryA, donorA, attacker;

  beforeEach(async () => {
    [owner, beneficiaryA, , donorA, , attacker] = await ethers.getSigners();

    const GiveChain = await ethers.getContractFactory("GiveChain");
    giveChain = await GiveChain.deploy();
    await giveChain.waitForDeployment();

    const RefundAttacker = await ethers.getContractFactory("RefundAttacker");
    refundAttacker = await RefundAttacker.connect(attacker).deploy(
      await giveChain.getAddress()
    );
    await refundAttacker.waitForDeployment();

    await giveChain.createCampaign("교육 지원", parseEther("10"), beneficiaryA);
    await giveChain.connect(donorA).donate(0, { value: parseEther("4") });
    await refundAttacker.connect(attacker).donate(0, { value: parseEther("1") });
    await giveChain.finalizeCampaign(0); // FAILED
  });

  it("재진입을 시도해도 공격자는 허용된 환불액을 초과하여 자산을 획득할 수 없어야 한다", async () => {
    const giveChainAddress = await giveChain.getAddress();
    const attackerAddress = await refundAttacker.getAddress();

    expect(await ethers.provider.getBalance(giveChainAddress))
      .to.equal(parseEther("5"));

    await refundAttacker.connect(attacker).attack(0);

    // 재진입이 실제로 시도되었고 차단되었는지 확인
    expect(await refundAttacker.reentryAttempts()).to.equal(1n);
    expect(await refundAttacker.reentrySuccesses()).to.equal(0n);

    // ASSERTION 01 · 공격자 추가 자금 = 0
    expect(await ethers.provider.getBalance(attackerAddress))
      .to.equal(parseEther("1"));

    // ASSERTION 02 · donations[id][attacker] = 0
    expect(await giveChain.donations(0, attackerAddress)).to.equal(0n);

    // ASSERTION 03 · Balance는 약속액만 감소
    expect(await ethers.provider.getBalance(giveChainAddress))
      .to.equal(parseEther("4"));
  });
});
