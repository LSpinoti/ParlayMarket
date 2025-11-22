# Deployment Guide for ParlayMarket

## Prerequisites

1. **Node.js & npm** installed
2. **MetaMask** browser extension
3. **FLR/C2FLR tokens** for gas fees
4. **Hardhat** or **Foundry** for contract deployment (choose one)

## Option A: Deploy with Hardhat

### 1. Install Hardhat

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

### 2. Create `hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    coston2: {
      url: "https://coston2-api.flare.network/ext/C/rpc",
      accounts: [process.env.PRIVATE_KEY || ""],
      chainId: 114,
    },
    flare: {
      url: "https://flare-api.flare.network/ext/C/rpc",
      accounts: [process.env.PRIVATE_KEY || ""],
      chainId: 14,
    },
  },
};

export default config;
```

### 3. Create `.env`

```bash
PRIVATE_KEY=your_private_key_here
```

### 4. Create deployment script `scripts/deploy.ts`

```typescript
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying ParlayMarket contracts...");

  // Deploy Mock Oracle (for testnet)
  const MockOracle = await ethers.getContractFactory("MockPolymarketOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("MockPolymarketOracle deployed to:", await oracle.getAddress());

  // Deploy ParlayMarket
  const ParlayMarket = await ethers.getContractFactory("ParlayMarket");
  const parlayMarket = await ParlayMarket.deploy(await oracle.getAddress());
  await parlayMarket.waitForDeployment();
  console.log("ParlayMarket deployed to:", await parlayMarket.getAddress());

  // Get ParlayToken address
  const tokenAddress = await parlayMarket.parlayToken();
  console.log("ParlayToken deployed to:", tokenAddress);

  console.log("\n📋 Update lib/contracts.ts with these addresses:");
  console.log(`ParlayMarket: '${await parlayMarket.getAddress()}'`);
  console.log(`MockOracle: '${await oracle.getAddress()}'`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### 5. Deploy

```bash
# Deploy to Coston2 testnet
npx hardhat run scripts/deploy.ts --network coston2

# Deploy to Flare mainnet
npx hardhat run scripts/deploy.ts --network flare
```

## Option B: Deploy with Foundry

### 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Initialize Foundry project

```bash
forge init --no-commit
```

### 3. Copy contracts to `src/` directory

```bash
cp -r contracts/* src/
```

### 4. Deploy

```bash
# Deploy MockOracle
forge create src/MockPolymarketOracle.sol:MockPolymarketOracle \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY

# Deploy ParlayMarket (use oracle address from above)
forge create src/ParlayMarket.sol:ParlayMarket \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --private-key $PRIVATE_KEY \
  --constructor-args <ORACLE_ADDRESS>
```

## Post-Deployment

### 1. Update Contract Addresses

Edit `lib/contracts.ts` and update the contract addresses:

```typescript
export const CONTRACT_ADDRESSES = {
  coston2: {
    ParlayMarket: '0xYOUR_DEPLOYED_ADDRESS',
    MockOracle: '0xYOUR_ORACLE_ADDRESS',
  },
  // ...
};
```

### 2. Test the Contracts (Optional)

Create a test parlay to verify everything works:

1. Connect your wallet to the frontend
2. Navigate to "Create Parlay"
3. Add some test UMA IDs (use any bytes32 hex values for testing)
4. Set stakes and create

### 3. Set Mock Oracle Outcomes (Testnet Only)

For testing on Coston2, you can manually set outcomes using the MockOracle:

```javascript
// In browser console or script
const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, signer);
await oracle.setOutcome("0x1234...", 1); // 1 = YES
```

## Verification (Optional)

### Hardhat

```bash
npx hardhat verify --network coston2 DEPLOYED_ADDRESS CONSTRUCTOR_ARGS
```

### Foundry

```bash
forge verify-contract \
  --chain-id 114 \
  --compiler-version v0.8.20 \
  DEPLOYED_ADDRESS \
  src/ParlayMarket.sol:ParlayMarket \
  --constructor-args $(cast abi-encode "constructor(address)" ORACLE_ADDRESS)
```

## Mainnet Considerations

When deploying to Flare mainnet:

1. **Real Oracle**: Replace MockPolymarketOracle with actual Flare Data Connector integration for Polymarket
2. **Security Audit**: Get contracts audited before mainnet deployment
3. **Gas Optimization**: Consider optimizing contracts for gas efficiency
4. **Access Control**: Consider adding admin functions with proper access control
5. **Pause Mechanism**: Add emergency pause functionality

## Troubleshooting

- **Insufficient Funds**: Ensure you have C2FLR/FLR for gas fees
- **Wrong Network**: Double-check you're connected to the correct network (chainId 114 for Coston2, 14 for Flare)
- **RPC Issues**: Try alternative RPC endpoints if deployment fails
- **Contract Size**: If contract is too large, enable optimizer in compiler settings

## Get Testnet Tokens

Coston2 Faucet: https://faucet.flare.network/coston2

