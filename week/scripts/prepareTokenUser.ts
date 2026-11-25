import { network } from "hardhat";
const { ethers } = await network.create();

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const userAddress = process.env.USER_ADDRESS;

  if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error("Invalid TOKEN_ADDRESS");
  if (!userAddress || !ethers.isAddress(userAddress)) throw new Error("Invalid USER_ADDRESS");

  const [deployer] = await ethers.getSigners();

  // 1) Local ETH (gas-д)
  await (await deployer.sendTransaction({ to: userAddress, value: ethers.parseEther("5") })).wait();

  // 2) GVT (ERC-20 transfer)
  const token = await ethers.getContractAt("GiveToken", tokenAddress);
  await (await token.transfer(userAddress, ethers.parseUnits("1000", 18))).wait();

  console.log("User:", userAddress, "· 5 Local ETH sent · 1000 GVT sent");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
