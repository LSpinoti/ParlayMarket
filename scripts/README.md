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

## Oracle Selection

- **Local/Hardhat**: Automatically uses MockPolymarketOracle
- **Coston2**: Automatically uses MockPolymarketOracle (can override with USE_MOCK_ORACLE=false)
- **Flare Mainnet**: Uses FlarePolymarketOracle by default

## Deployment Output

Deployment info is saved to `deployments/{network}-{chainId}.json`

## Contract Verification

After deployment, verify contracts using the commands printed by the script.
