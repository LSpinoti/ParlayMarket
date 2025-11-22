import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying ParlayMarketplace with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLR");
  console.log("");

  // Your existing ParlayToken address on Coston2
  const PARLAY_TOKEN_ADDRESS = "0xE2126732D634eB67aC1FE94D0Be5F3Ea637dd345";

  console.log("Existing ParlayToken:", PARLAY_TOKEN_ADDRESS);
  console.log("");

  // Deploy ParlayMarketplace
  console.log("Deploying ParlayMarketplace...");
  const Marketplace = await ethers.getContractFactory("ParlayMarketplace");
  const marketplace = await Marketplace.deploy(PARLAY_TOKEN_ADDRESS);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log("");
  console.log("=".repeat(50));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log("");
  console.log("ParlayMarketplace:", marketplaceAddress);
  console.log("");
  console.log("Features:");
  console.log("  - List parlay positions for sale");
  console.log("  - Buy positions with FLR");
  console.log("  - 1% platform fee on sales");
  console.log("  - Cancel listings anytime");
  console.log("");
  console.log("Update lib/contracts.ts with this address.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
