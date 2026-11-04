import { network } from "hardhat";
const { ethers } = await network.create();

async function main() {
  const [owner] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();

  console.log("Deploying GiveChain...");
  console.log("Owner:", ownerAddress);

  const GiveChain = await ethers.getContractFactory("GiveChain");

  const giveChain = await GiveChain.deploy();
  await giveChain.waitForDeployment();

  const contractAddress = await giveChain.getAddress();

  console.log("GiveChain deployed to:", contractAddress);

  const contractOwner = await giveChain.getFunction("owner")();

  const campaignCount = await giveChain.getFunction("campaignCount")();

  console.log("Contract owner:", contractOwner);
  console.log("Campaign count:", campaignCount);
}
main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
