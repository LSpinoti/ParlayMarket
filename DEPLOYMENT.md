# Quick Start Deployment Guide

Follow these steps to deploy and run ParlayMarket:

## 1. Install Dependencies

```bash
npm install
```

## 2. Deploy Smart Contracts

### Option A: Using Hardhat (Recommended)

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv

# Copy example config
cp hardhat.config.example.ts hardhat.config.ts

# Create .env file with your private key
echo "PRIVATE_KEY=your_private_key_here" > .env

# Deploy to Coston2 testnet
npx hardhat run scripts/deploy.ts --network coston2
```

### Option B: Manual Deployment

1. Use [Remix IDE](https://remix.ethereum.org/)
2. Copy contracts from `/contracts` folder
3. Compile with Solidity 0.8.20
4. Deploy `MockPolymarketOracle` first
5. Deploy `ParlayMarket` with oracle address
6. `ParlayToken` will be automatically deployed

## 3. Update Contract Addresses

After deployment, edit `lib/contracts.ts`:

```typescript
export const CONTRACT_ADDRESSES = {
  coston2: {
    ParlayMarket: '0xYOUR_DEPLOYED_ADDRESS_HERE',
    MockOracle: '0xYOUR_ORACLE_ADDRESS_HERE',
  },
};
```

## 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Get Test Tokens

Get Coston2 FLR from: https://faucet.flare.network/coston2

## 6. Connect & Test

1. Click "Connect Wallet"
2. Switch to Coston2 network when prompted
3. Create a test parlay
4. Fill it from another account or have someone else fill it

## Testing Resolution

To test parlay resolution with MockOracle:

```javascript
// In browser console after connecting wallet
const oracle = new ethers.Contract(
  ORACLE_ADDRESS,
  ['function setOutcome(bytes32 umaId, uint8 outcome) external'],
  signer
);

// Set outcome: 0=NO, 1=YES, 2=INVALID
await oracle.setOutcome('0x1234...', 1);
```

## Troubleshooting

**"Cannot connect wallet"**
- Install MetaMask browser extension
- Allow the connection when prompted

**"Wrong network"**
- Click "Connect Wallet" to trigger network switch
- Or manually add Coston2 in MetaMask

**"Transaction failed"**
- Check you have enough C2FLR for gas
- Verify contract addresses are correct in `lib/contracts.ts`

**"Parlays not loading"**
- Check browser console for errors
- Verify you're connected to correct network
- Refresh the page

## Next Steps

- Read full [README.md](README.md) for detailed documentation
- See [scripts/deploy.md](scripts/deploy.md) for advanced deployment options
- Check smart contracts in `/contracts` folder
- Explore the codebase structure

## Need Help?

- Check existing GitHub issues
- Review Flare Network documentation: https://docs.flare.network/
- Join Flare Discord: https://discord.com/invite/flarenetwork

