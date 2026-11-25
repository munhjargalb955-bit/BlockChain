import { network } from "hardhat";
const { ethers } = await network.create();

async function main() {
  const [deployer] = await ethers.getSigners();

  const GiveToken = await ethers.getContractFactory("GiveToken");
  const supply = ethers.parseUnits("100000", 18);

  const token = await GiveToken.deploy(supply);
  await token.waitForDeployment();

  const addr = await token.getAddress();
  console.log("Deployer:", await deployer.getAddress());
  console.log("GiveToken:", addr);
  console.log("Name:", await token.name());
  console.log("Symbol:", await token.symbol());
  console.log("Total Supply:", ethers.formatUnits(await token.totalSupply(), 18), "GVT");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
