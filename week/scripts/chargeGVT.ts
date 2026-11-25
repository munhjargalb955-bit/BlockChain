import { network } from "hardhat";
const { ethers } = await network.create();

// Simulates "KRW payment confirmed off-chain -> operator mints GVT" (1 GVT = 1 KRW).
async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const userAddress = process.env.USER_ADDRESS;
  const chargeAmount = process.env.CHARGE_AMOUNT ?? "50000";

  if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error("Invalid TOKEN_ADDRESS");
  if (!userAddress || !ethers.isAddress(userAddress)) throw new Error("Invalid USER_ADDRESS");

  const token = await ethers.getContractAt("GiveTokenV2", tokenAddress);
  const decimals = await token.decimals();
  const amount = ethers.parseUnits(chargeAmount, decimals);

  await (await token.mintForCharge(userAddress, amount)).wait();

  console.log("User:", userAddress);
  console.log("Charge:", chargeAmount, "GVT");
  console.log("Balance:", ethers.formatUnits(await token.balanceOf(userAddress), decimals), "GVT");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
