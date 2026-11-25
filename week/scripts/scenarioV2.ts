import { network } from "hardhat";

const { ethers } = await network.create();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const GIVECHAIN_ADDRESS = process.env.GIVECHAIN_ADDRESS;

if (!TOKEN_ADDRESS || !ethers.isAddress(TOKEN_ADDRESS)) {
  throw new Error("TOKEN_ADDRESS를 확인하세요.");
}

if (!GIVECHAIN_ADDRESS || !ethers.isAddress(GIVECHAIN_ADDRESS)) {
  throw new Error("GIVECHAIN_ADDRESS를 확인하세요.");
}

const [owner, donor, beneficiary] = await ethers.getSigners();

const ownerAddress = await owner.getAddress();
const donorAddress = await donor.getAddress();
const beneficiaryAddress = await beneficiary.getAddress();

console.log("Owner:", ownerAddress);
console.log("Donor:", donorAddress);
console.log("Beneficiary:", beneficiaryAddress);

const token = await ethers.getContractAt(
  "GiveTokenV2",
  TOKEN_ADDRESS,
  owner
);

const giveChain = await ethers.getContractAt(
  "GiveChainV2",
  GIVECHAIN_ADDRESS,
  owner
);

const decimals = Number(await token.decimals());
const goal = ethers.parseUnits("500", decimals);

const initialMint = ethers.parseUnits("1000", decimals);

console.log("\n[1] Mint 1000 GVT");
await (
  await token.mintForCharge(donorAddress, initialMint)
).wait();

const successId = await giveChain.campaignCount();

console.log("\n[2] Create SUCCESS campaign:", successId.toString());
await (
  await giveChain.createCampaign(
    "Education Support",
    goal,
    beneficiaryAddress,
    TOKEN_ADDRESS
  )
).wait();

const successDonation = ethers.parseUnits("600", decimals);

console.log("\n[3] Approve 600 GVT");
await (
  await token.connect(donor).approve(
    GIVECHAIN_ADDRESS,
    successDonation
  )
).wait();

console.log("[4] Donate 600 GVT");
await (
  await giveChain.connect(donor).donateToken(
    successId,
    successDonation
  )
).wait();

console.log("\n[5] Finalize SUCCESS");
await (
  await giveChain.finalizeCampaign(successId)
).wait();

console.log("\n[6] Beneficiary withdraw");
await (
  await giveChain.connect(beneficiary).withdraw(successId)
).wait();

const failedId = await giveChain.campaignCount();

console.log("\n[7] Create FAILED campaign:", failedId.toString());
await (
  await giveChain.createCampaign(
    "Medical Support",
    goal,
    beneficiaryAddress,
    TOKEN_ADDRESS
  )
).wait();

const failedDonation = ethers.parseUnits("100", decimals);

console.log("\n[8] Approve 100 GVT");
await (
  await token.connect(donor).approve(
    GIVECHAIN_ADDRESS,
    failedDonation
  )
).wait();

console.log("[9] Donate 100 GVT");
await (
  await giveChain.connect(donor).donateToken(
    failedId,
    failedDonation
  )
).wait();

console.log("\n[10] Finalize FAILED");
await (
  await giveChain.finalizeCampaign(failedId)
).wait();

console.log("\n[11] Donor refund");
await (
  await giveChain.connect(donor).refund(failedId)
).wait();

console.log("\nScenario complete.");
