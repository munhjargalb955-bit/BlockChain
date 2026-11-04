import { network } from "hardhat";
const { ethers } = await network.create();
async function main() {
  const [sender] = await ethers.getSigners();
  const metaMaskAddress = process.env.METAMASK_ADDRESS;
  const tx = await sender.sendTransaction({
    to: metaMaskAddress,
    value: ethers.parseEther("10"),
  });
  await tx.wait();
}
main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
