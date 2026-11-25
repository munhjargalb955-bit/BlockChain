import { network } from "hardhat";
const { ethers } = await network.create();
const { parseUnits, formatUnits } = ethers;

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const chainAddress = process.env.GIVECHAIN_ADDRESS;
  if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error("Invalid TOKEN_ADDRESS");
  if (!chainAddress || !ethers.isAddress(chainAddress)) throw new Error("Invalid GIVECHAIN_ADDRESS");

  const [owner, donor, beneficiary] = await ethers.getSigners();
  const donorAddr = await donor.getAddress();
  const benAddr = await beneficiary.getAddress();

  const token = await ethers.getContractAt("GiveTokenV2", tokenAddress);
  const giveChain = await ethers.getContractAt("GiveChainV2", chainAddress);

  const dec = await token.decimals();
  const gvt = (n: string) => parseUnits(n, dec);
  const bal = async (a: string) => formatUnits(await token.balanceOf(a), dec);
  const stageName = ["NONE", "OPEN", "SUCCESS", "FAILED"];

  const idBase = await giveChain.campaignCount(); // works on a non-fresh deployment too
  const id0 = idBase;
  const id1 = idBase + 1n;

  // ---- Campaign A: SUCCESS -> withdraw ----
  await (await token.mintForCharge(donorAddr, gvt("1000"))).wait();
  console.log("1. mint        donor:", await bal(donorAddr));

  await (await giveChain.createCampaign("교육 지원", gvt("500"), benAddr, tokenAddress)).wait();
  await (await token.connect(donor).approve(chainAddress, gvt("600"))).wait();
  await (await giveChain.connect(donor).donateToken(id0, gvt("600"))).wait();
  console.log("2. donate 600  donor:", await bal(donorAddr), "raised:", formatUnits((await giveChain.campaigns(id0)).raised, dec));

  await (await giveChain.finalizeCampaign(id0)).wait();
  console.log("3. finalize    stage:", stageName[Number((await giveChain.campaigns(id0)).stage)]);

  const benBefore = await token.balanceOf(benAddr);
  await (await giveChain.connect(beneficiary).withdraw(id0)).wait();
  console.log("4. withdraw    beneficiary +", formatUnits((await token.balanceOf(benAddr)) - benBefore, dec));

  // ---- Campaign B: FAILED -> refund ----
  await (await giveChain.createCampaign("동물 보호", gvt("500"), benAddr, tokenAddress)).wait();
  await (await token.connect(donor).approve(chainAddress, gvt("100"))).wait();
  await (await giveChain.connect(donor).donateToken(id1, gvt("100"))).wait();
  await (await giveChain.finalizeCampaign(id1)).wait();
  console.log("5. finalize #B stage:", stageName[Number((await giveChain.campaigns(id1)).stage)]);

  const donorBefore = await token.balanceOf(donorAddr);
  await (await giveChain.connect(donor).refund(id1)).wait();
  console.log("6. refund      donor +", formatUnits((await token.balanceOf(donorAddr)) - donorBefore, dec));

  console.log("\nFinal  donor:", await bal(donorAddr), "| beneficiary:", await bal(benAddr),
    "| GiveChain GVT:", formatUnits(await giveChain.getContractAssetBalance(tokenAddress), dec));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
