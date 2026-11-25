import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.create();
const { parseUnits } = ethers;

describe("GiveToken (ERC-20)", () => {
  const SUPPLY = parseUnits("100000", 18);
  let token: any;
  let deployer: any, alice: any, bob: any, carol: any;

  beforeEach(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();
    const GiveToken = await ethers.getContractFactory("GiveToken");
    token = await GiveToken.deploy(SUPPLY);
    await token.waitForDeployment();
  });

  describe("metadata & mint", () => {
    it("name, symbol, decimals가 올바르다", async () => {
      expect(await token.name()).to.equal("GiveToken");
      expect(await token.symbol()).to.equal("GVT");
      expect(await token.decimals()).to.equal(18n);
    });

    it("배포자에게 initialSupply가 mint 된다", async () => {
      expect(await token.totalSupply()).to.equal(SUPPLY);
      expect(await token.balanceOf(deployer)).to.equal(SUPPLY);
    });

    it("배포 시 address(0) -> deployer Transfer 이벤트가 발생한다", async () => {
      const receipt = await token.deploymentTransaction().wait();
      const log = receipt.logs
        .map((l: any) => token.interface.parseLog(l))
        .find((p: any) => p?.name === "Transfer");
      expect(log.args.from).to.equal(ethers.ZeroAddress);
      expect(log.args.to).to.equal(await deployer.getAddress());
      expect(log.args.value).to.equal(SUPPLY);
    });
  });

  describe("transfer", () => {
    it("소유권만 이동하고 totalSupply는 그대로다", async () => {
      await token.transfer(alice, parseUnits("1000", 18));
      expect(await token.balanceOf(alice)).to.equal(parseUnits("1000", 18));
      expect(await token.balanceOf(deployer)).to.equal(SUPPLY - parseUnits("1000", 18));
      expect(await token.totalSupply()).to.equal(SUPPLY);
    });

    it("Transfer 이벤트를 emit 한다", async () => {
      await expect(token.transfer(alice, 100n))
        .to.emit(token, "Transfer")
        .withArgs(await deployer.getAddress(), await alice.getAddress(), 100n);
    });

    it("잔액이 부족하면 revert 한다", async () => {
      await expect(token.connect(alice).transfer(bob, 1n)).to.be.revertedWithCustomError(
        token,
        "ERC20InsufficientBalance",
      );
    });

    it("parseUnits로 소수점 금액(1.5 GVT)을 전송할 수 있다", async () => {
      const amount = parseUnits("1.5", 18);
      expect(amount).to.equal(1500000000000000000n);
      await token.transfer(alice, amount);
      expect(ethers.formatUnits(await token.balanceOf(alice), 18)).to.equal("1.5");
    });
  });

  describe("approve / allowance", () => {
    it("approve는 allowance만 바꾸고 balance는 바꾸지 않는다", async () => {
      await token.transfer(alice, parseUnits("1000", 18));
      await token.connect(alice).approve(bob, parseUnits("200", 18));

      expect(await token.allowance(alice, bob)).to.equal(parseUnits("200", 18));
      expect(await token.balanceOf(alice)).to.equal(parseUnits("1000", 18));
      expect(await token.balanceOf(bob)).to.equal(0n);
    });

    it("Approval 이벤트를 emit 한다", async () => {
      await expect(token.connect(alice).approve(bob, 5n))
        .to.emit(token, "Approval")
        .withArgs(await alice.getAddress(), await bob.getAddress(), 5n);
    });

    it("approve(spender, 0)으로 권한을 취소할 수 있다", async () => {
      await token.connect(alice).approve(bob, 100n);
      await token.connect(alice).approve(bob, 0n);
      expect(await token.allowance(alice, bob)).to.equal(0n);
    });
  });

  describe("transferFrom", () => {
    beforeEach(async () => {
      await token.transfer(alice, parseUnits("1000", 18));
      await token.connect(alice).approve(bob, parseUnits("200", 18));
    });

    it("Bob이 Alice의 토큰을 Carol에게 대신 이동한다", async () => {
      await token.connect(bob).transferFrom(alice, carol, parseUnits("50", 18));

      expect(await token.balanceOf(alice)).to.equal(parseUnits("950", 18));
      expect(await token.balanceOf(carol)).to.equal(parseUnits("50", 18));
      expect(await token.allowance(alice, bob)).to.equal(parseUnits("150", 18));
    });

    it("allowance를 초과하면 revert 한다", async () => {
      await expect(
        token.connect(bob).transferFrom(alice, carol, parseUnits("201", 18)),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("approve 없이는 transferFrom이 revert 한다", async () => {
      await expect(
        token.connect(carol).transferFrom(alice, carol, 1n),
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });
});
