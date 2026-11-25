import { network } from "hardhat";
const { ethers } = await network.create();

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("Deployer:", deployerAddress);

  // 1) Token first
  const GiveTokenV2 = await ethers.getContractFactory("GiveTokenV2");
  const token = await GiveTokenV2.deploy(deployerAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  // 2) Chain
  const GiveChainV2 = await ethers.getContractFactory("GiveChainV2");
  const giveChain = await GiveChainV2.deploy();
  await giveChain.waitForDeployment();
  const chainAddress = await giveChain.getAddress();

  console.log("GiveTokenV2:", tokenAddress);
  console.log("GiveChainV2:", chainAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
