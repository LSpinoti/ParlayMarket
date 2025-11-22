// Sample Hardhat deployment script
// To use this:
// 1. Install hardhat: npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
// 2. Create hardhat.config.ts (see deploy.md)
// 3. Set PRIVATE_KEY in .env
// 4. Run: npx hardhat run scripts/deploy.ts --network coston2

import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying ParlayMarket contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLR\n");

  // Deploy Mock Oracle (for testnet)
  console.log("📡 Deploying MockPolymarketOracle...");
  const MockOracle = await ethers.getContractFactory("MockPolymarketOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("✅ MockPolymarketOracle deployed to:", oracleAddress, "\n");

  // Deploy ParlayMarket
  console.log("🎯 Deploying ParlayMarket...");
  const ParlayMarket = await ethers.getContractFactory("ParlayMarket");
  const parlayMarket = await ParlayMarket.deploy(oracleAddress);
  await parlayMarket.waitForDeployment();
  const parlayMarketAddress = await parlayMarket.getAddress();
  console.log("✅ ParlayMarket deployed to:", parlayMarketAddress, "\n");

  // Get ParlayToken address
  const tokenAddress = await parlayMarket.parlayToken();
  console.log("💎 ParlayToken deployed to:", tokenAddress, "\n");

  console.log("=" .repeat(60));
  console.log("\n📋 DEPLOYMENT SUMMARY\n");
  console.log("ParlayMarket:", parlayMarketAddress);
  console.log("ParlayToken:", tokenAddress);
  console.log("MockOracle:", oracleAddress);
  console.log("\n" + "=".repeat(60));
  
  console.log("\n🔧 UPDATE lib/contracts.ts with these addresses:");
  console.log(`
export const CONTRACT_ADDRESSES = {
  coston2: {
    ParlayMarket: '${parlayMarketAddress}',
    MockOracle: '${oracleAddress}',
  },
  // ...
};
  `);

  console.log("\n✨ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

