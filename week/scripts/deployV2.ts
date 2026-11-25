import { network } from "hardhat";

const { ethers } = await network.create();

const [deployer] = await ethers.getSigners();
const deployerAddress = await deployer.getAddress();

console.log("Deployer:", deployerAddress);

const token = await ethers.deployContract(
  "GiveTokenV2",
  [deployerAddress]
);

await token.waitForDeployment();

const tokenAddress = await token.getAddress();
console.log("GiveTokenV2:", tokenAddress);

const giveChain = await ethers.deployContract("GiveChainV2");
await giveChain.waitForDeployment();

const giveChainAddress = await giveChain.getAddress();
console.log("GiveChainV2:", giveChainAddress);

console.log("\nDeployment complete.");
