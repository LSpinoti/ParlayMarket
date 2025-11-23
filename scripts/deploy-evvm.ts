import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying EVVM contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLR");
  console.log("");

  // Flare FTSO Registry addresses
  const FTSO_REGISTRY = {
    coston2: "0xC67DCE33b7C6b9A6B2e657A50a0deAB4F42F8D14",
    flare: "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019",
  };

  // Detect network
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const ftsoRegistry = chainId === 114 ? FTSO_REGISTRY.coston2 : FTSO_REGISTRY.flare;

  console.log(`Network: ${chainId === 114 ? 'Coston2' : 'Flare'} (${chainId})`);
  console.log(`FTSO Registry: ${ftsoRegistry}`);
  console.log("");

  // 1. Deploy EVVM_Hub
  console.log("1. Deploying EVVM_Hub...");
  const EVVM_Hub = await ethers.getContractFactory("EVVM_Hub");
  const evvmHub = await EVVM_Hub.deploy(ftsoRegistry);
  await evvmHub.waitForDeployment();
  const evvmHubAddress = await evvmHub.getAddress();
  console.log("   EVVM_Hub deployed to:", evvmHubAddress);

  // 2. Deploy Vault
  console.log("2. Deploying Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(evvmHubAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   Vault deployed to:", vaultAddress);

  // 3. Deploy Betting_Logic
  console.log("3. Deploying Betting_Logic...");
  const BettingLogic = await ethers.getContractFactory("Betting_Logic");
  const bettingLogic = await BettingLogic.deploy(ftsoRegistry, evvmHubAddress);
  await bettingLogic.waitForDeployment();
  const bettingLogicAddress = await bettingLogic.getAddress();
  console.log("   Betting_Logic deployed to:", bettingLogicAddress);

  // Summary
  console.log("");
  console.log("=".repeat(50));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log("");
  console.log("Contract Addresses:");
  console.log(`  EVVM_Hub:      ${evvmHubAddress}`);
  console.log(`  Vault:         ${vaultAddress}`);
  console.log(`  Betting_Logic: ${bettingLogicAddress}`);
  console.log("");
  console.log("Update your .env file:");
  console.log(`  EVVM_HUB_ADDRESS=${evvmHubAddress}`);
  console.log("");
  console.log("Update lib/contracts.ts with these addresses.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
