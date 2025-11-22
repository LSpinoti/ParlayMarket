import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying EVVM Wrapper with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "FLR");
  console.log("");

  // Your existing ParlayMarket address on Coston2
  const PARLAY_MARKET_ADDRESS = "0xa95fEBb5f7A256FCB1b317F94c41F346a8735d15";

  console.log("Existing ParlayMarket:", PARLAY_MARKET_ADDRESS);
  console.log("");

  // Deploy EVVM_ParlayWrapper
  console.log("Deploying EVVM_ParlayWrapper...");
  const Wrapper = await ethers.getContractFactory("EVVM_ParlayWrapper");
  const wrapper = await Wrapper.deploy(PARLAY_MARKET_ADDRESS);
  await wrapper.waitForDeployment();
  const wrapperAddress = await wrapper.getAddress();

  console.log("");
  console.log("=".repeat(50));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log("");
  console.log("EVVM_ParlayWrapper:", wrapperAddress);
  console.log("");
  console.log("Update your relayer .env:");
  console.log(`  EVVM_HUB_ADDRESS=${wrapperAddress}`);
  console.log("");
  console.log("This wrapper provides:");
  console.log("  - Virtual balances (deposit/withdraw)");
  console.log("  - Dark Pool (commit-reveal) privacy");
  console.log("  - Rapid-fire betting via intents");
  console.log("  - Batch parlay creation");
  console.log("");
  console.log("All parlays are created on your existing ParlayMarket contract.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
