const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment script for ParlayMarket contracts
 * Deploys FlarePolymarketOracle for all networks
 */
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  
  console.log("=".repeat(60));
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("=".repeat(60));

  // Deploy Flare Oracle
  // FDC Verification contract addresses:
  // - Coston2: 0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91
  // - Flare Mainnet: 0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91
  const fdcAddress = process.env.FDC_VERIFICATION_ADDRESS || "0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91";
  
  console.log("\nDeploying FlarePolymarketOracle...");
  console.log("Using FDC Verification at:", fdcAddress);
  
  const FlareOracle = await hre.ethers.getContractFactory("FlarePolymarketOracle");
  const flareOracle = await FlareOracle.deploy(fdcAddress);
  await flareOracle.waitForDeployment();
  const oracleAddress = await flareOracle.getAddress();
  console.log("FlarePolymarketOracle deployed to:", oracleAddress);

  // Deploy ParlayMarket (ParlayToken will be deployed automatically)
  console.log("\nDeploying ParlayMarket...");
  const ParlayMarket = await hre.ethers.getContractFactory("ParlayMarket");
  const parlayMarket = await ParlayMarket.deploy(oracleAddress);
  await parlayMarket.waitForDeployment();
  const parlayMarketAddress = await parlayMarket.getAddress();
  console.log("ParlayMarket deployed to:", parlayMarketAddress);

  // Get ParlayToken address (deployed by ParlayMarket constructor)
  const parlayTokenAddress = await parlayMarket.parlayToken();
  console.log("ParlayToken deployed to:", parlayTokenAddress);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      flarePolymarketOracle: oracleAddress,
      parlayMarket: parlayMarketAddress,
      parlayToken: parlayTokenAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(deploymentsDir, `${network.name}-${network.chainId}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("Deployment Summary:");
  console.log("=".repeat(60));
  console.log("FlarePolymarketOracle:", oracleAddress);
  console.log("ParlayMarket:", parlayMarketAddress);
  console.log("ParlayToken:", parlayTokenAddress);
  console.log("\nDeployment info saved to:", deploymentFile);
  console.log("=".repeat(60));

  // Verification instructions
  if (network.chainId !== 31337n) {
    console.log("\nTo verify contracts on block explorer:");
    console.log(`  npx hardhat verify --network ${network.name} ${oracleAddress} "${fdcAddress}"`);
    console.log(`  npx hardhat verify --network ${network.name} ${parlayMarketAddress} "${oracleAddress}"`);
    console.log(`  npx hardhat verify --network ${network.name} ${parlayTokenAddress} "${parlayMarketAddress}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
