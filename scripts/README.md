# Deployment Scripts

## Usage

### Deploy to Local Hardhat Network
```bash
npx hardhat run scripts/deploy.ts --network hardhat
```

### Deploy to Coston2 Testnet
```bash
npx hardhat run scripts/deploy.ts --network coston2
```

### Deploy to Flare Mainnet
```bash
npx hardhat run scripts/deploy.ts --network flare
```

## Configuration

Create a `.env` file with your private key:
```
PRIVATE_KEY=your_private_key_without_0x_prefix
```

## Oracle

All networks use **FlarePolymarketOracle** integrated with Flare Data Connector (FDC).

## Deployment Output

Deployment info is saved to `deployments/{network}-{chainId}.json`

## Contract Verification

After deployment, verify contracts using the commands printed by the script.
