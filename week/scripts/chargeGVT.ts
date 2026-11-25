import { network } from "hardhat";

const { ethers } = await network.create();

const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const USER_ADDRESS = process.env.USER_ADDRESS;
const CHARGE_AMOUNT = process.env.CHARGE_AMOUNT ?? "50000";

if (!TOKEN_ADDRESS || !ethers.isAddress(TOKEN_ADDRESS)) {
  throw new Error("TOKEN_ADDRESS를 확인하세요.");
}

if (!USER_ADDRESS || !ethers.isAddress(USER_ADDRESS)) {
  throw new Error("USER_ADDRESS를 확인하세요.");
}

const [owner] = await ethers.getSigners();
const ownerAddress = await owner.getAddress();

console.log("Mint Owner:", ownerAddress);

const token = await ethers.getContractAt(
  "GiveTokenV2",
  TOKEN_ADDRESS,
  owner
);

const decimals = Number(await token.decimals());
const amount = ethers.parseUnits(CHARGE_AMOUNT, decimals);

console.log("User:", USER_ADDRESS);
console.log("Charge:", CHARGE_AMOUNT, "GVT");

const tx = await token.mintForCharge(USER_ADDRESS, amount);
console.log("Transaction:", tx.hash);

await tx.wait();

const balance = await token.balanceOf(USER_ADDRESS);

console.log(
  "GVT Balance:",
  ethers.formatUnits(balance, decimals)
);
