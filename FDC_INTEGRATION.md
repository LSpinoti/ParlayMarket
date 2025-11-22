# Flare Data Connector (FDC) Integration Guide

This document explains how ParlayMarket integrates with Flare's Data Connector to fetch and verify Polymarket UMA resolution data.

## Overview

The **FlarePolymarketOracle** contract uses Flare's Data Connector (FDC) to bring Polymarket UMA resolution data on-chain in a trust-minimized way.

## Architecture

```
Polymarket UMA        FDC Data          FDC                 Flare
Resolution      -->   Providers   -->   Verification  -->   Polymarket
(Off-chain)           (Attestors)       (On-chain)          Oracle
                                                              |
                                                              v
                                                         ParlayMarket
                                                         (Settlement)
```

## How It Works

### 1. Data Source: Polymarket UMA Resolutions

Polymarket uses UMA's Optimistic Oracle to resolve prediction market outcomes:
- Each market has a unique **UMA Question ID** (bytes32)
- Outcomes are resolved to: **0 (NO)**, **1 (YES)**, or **2 (INVALID)**
- Resolutions are published on Ethereum mainnet

### 2. FDC Attestation Process

```solidity
// 1. Request attestation from FDC Hub
FdcHub.requestAttestation(
    attestationType,  // Type: EVM Transaction or API data
    sourceId,         // Ethereum mainnet (for UMA)
    requestData       // UMA question ID + request details
);

// 2. FDC providers verify the data off-chain
// 3. Merkle root published to Flare (every ~90s on testnet)
// 4. Attestation data available in Data Availability Layer
```

### 3. Oracle Verification

```solidity
// Submit verified outcome to FlarePolymarketOracle
oracle.submitOutcome(
    umaId,            // Polymarket UMA question ID
    outcome,          // 0=NO, 1=YES, 2=INVALID
    attestationData,  // Full attestation from FDC
    merkleProof       // Proof for verification
);
```

The oracle verifies the proof using FDC's verification contract:

```solidity
bool verified = fdcVerification.verifyAttestation(
    attestationData,
    merkleProof
);
```

## Contract Addresses

### Coston2 Testnet
- **FDC Verification**: `0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91`
- **FDC Hub**: Check [Flare Docs](https://dev.flare.network/fdc/overview)

### Flare Mainnet
- **FDC Verification**: `0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91`
- **FDC Hub**: Check [Flare Docs](https://dev.flare.network/fdc/overview)

## Usage Modes

### Production Mode: FDC Attestation

For production use with verified data:

```javascript
// 1. Get Polymarket UMA resolution data
const umaId = "0x..."; // UMA question ID
const outcome = 1;     // YES

// 2. Request FDC attestation (using FDC Hub contract)
const attestationRequest = {
  attestationType: "EVMTransaction", // or "APIData"
  sourceId: "eth",                    // Ethereum mainnet
  requestData: encodeUmaResolutionRequest(umaId)
};

const txRequest = await fdcHub.requestAttestation(
  attestationRequest.attestationType,
  attestationRequest.sourceId,
  attestationRequest.requestData
);

// 3. Wait for finalization (~90 seconds on Coston2)
await waitForFinalization(txRequest);

// 4. Retrieve attestation data and proof from Data Availability Layer
const { attestationData, merkleProof } = await getAttestationData(txRequest);

// 5. Submit to oracle
const oracle = new ethers.Contract(oracleAddress, oracleABI, signer);
await oracle.submitOutcome(umaId, outcome, attestationData, merkleProof);
```

### Testing Mode: Direct Setting

For testing without FDC (owner only):

```javascript
const oracle = new ethers.Contract(oracleAddress, oracleABI, signer);

// Single outcome
await oracle.setOutcomeDirect(umaId, 1); // 1 = YES

// Batch outcomes
await oracle.setOutcomesBatch(
  [umaId1, umaId2, umaId3],
  [1, 0, 2]  // YES, NO, INVALID
);
```

## Security Features

### Access Control
- **Owner**: Can set outcomes directly (for testing/emergency)
- **Attestors**: Authorized addresses that can submit FDC-verified outcomes
- **Anyone**: Can read outcomes (view functions)

### Verification
- All FDC submissions are verified through `FdcVerification` contract
- Invalid proofs are rejected
- Outcomes cannot be changed once set (immutable)

### Timestamps
- Each resolution includes a timestamp
- Enables time-based queries and auditing

## Integration Example

Here's a complete example of integrating FDC attestation into your frontend:

```typescript
// frontend/lib/fdc-oracle.ts
import { ethers } from 'ethers';

export async function resolvePolymarketOutcome(
  umaId: string,
  provider: ethers.Provider,
  signer: ethers.Signer
) {
  // 1. Fetch UMA resolution from Polymarket API
  const resolution = await fetch(
    `https://api.polymarket.com/uma/${umaId}`
  ).then(r => r.json());
  
  const outcome = resolution.outcome; // 0, 1, or 2
  
  // 2. Request FDC attestation
  const fdcHub = new ethers.Contract(
    FDC_HUB_ADDRESS,
    FDC_HUB_ABI,
    signer
  );
  
  const attestationRequest = encodeUmaRequest(umaId, resolution);
  const tx = await fdcHub.requestAttestation(
    "EVMTransaction",
    "eth",
    attestationRequest
  );
  
  await tx.wait();
  
  // 3. Wait for FDC finalization
  console.log("Waiting for FDC attestation...");
  await sleep(90000); // 90 seconds
  
  // 4. Fetch attestation data
  const { attestationData, merkleProof } = await fetchAttestationData(
    tx.hash,
    provider
  );
  
  // 5. Submit to oracle
  const oracle = new ethers.Contract(
    ORACLE_ADDRESS,
    ORACLE_ABI,
    signer
  );
  
  const submitTx = await oracle.submitOutcome(
    umaId,
    outcome,
    attestationData,
    merkleProof
  );
  
  await submitTx.wait();
  console.log("Outcome verified and submitted!");
  
  return outcome;
}
```

## Testing Guide

### Local Testing (Without FDC)

```bash
# 1. Deploy contracts
npx hardhat run scripts/deploy.ts --network localhost

# 2. Set outcomes directly (owner)
npx hardhat console --network localhost

> const oracle = await ethers.getContractAt("FlarePolymarketOracle", ORACLE_ADDRESS);
> await oracle.setOutcomeDirect("0x123...", 1); // YES
```

### Testnet Testing (With FDC)

```bash
# 1. Deploy to Coston2
npx hardhat run scripts/deploy.ts --network coston2

# 2. Add attestor address
npx hardhat console --network coston2

> const oracle = await ethers.getContractAt("FlarePolymarketOracle", ORACLE_ADDRESS);
> await oracle.addAttestor("0xYourAttestorAddress");

# 3. Submit attestation (from attestor address)
> await oracle.submitOutcome(umaId, outcome, attestationData, merkleProof);
```

## Monitoring & Maintenance

### Events to Monitor

```solidity
event OutcomeVerified(
    bytes32 indexed umaId,
    uint8 outcome,
    uint256 timestamp,
    address attestor
);

event AttestorAdded(address indexed attestor);
event AttestorRemoved(address indexed attestor);
```

### Recommended Setup

1. **Automated Attestor Service**: Run a service that monitors Polymarket UMA resolutions and automatically submits FDC attestations
2. **Fallback**: Use direct setting for emergency situations
3. **Monitoring**: Track all `OutcomeVerified` events
4. **Alerts**: Alert on failed attestations or verification errors

## Gas Costs

Approximate gas costs on Flare:

| Operation | Gas Cost | FLR Cost (at 0.02 FLR/tx) |
|-----------|----------|---------------------------|
| `submitOutcome()` (FDC) | ~150,000 | 0.003 FLR |
| `setOutcomeDirect()` | ~50,000 | 0.001 FLR |
| `setOutcomesBatch()` (10) | ~300,000 | 0.006 FLR |
| `getOutcome()` (view) | 0 (free) | 0 FLR |

## Troubleshooting

### "Attestation verification failed"
- Ensure attestation data and Merkle proof are correct
- Verify the data was finalized by FDC
- Check that you're using the correct FDC Verification address

### "Already resolved"
- Outcomes are immutable once set
- Deploy a new oracle or use a different UMA ID for testing

### "Not authorized"
- Only owner and attestors can submit outcomes
- Use `addAttestor()` to authorize addresses

## Resources

- **Flare FDC Docs**: https://dev.flare.network/fdc/overview
- **Flare FDC Whitepaper**: https://dev.flare.network/pdf/whitepapers/FlareDataConnector.pdf
- **UMA Documentation**: https://docs.umaproject.org/
- **Polymarket API**: https://docs.polymarket.com/

## Future Enhancements

- [ ] Automated attestation service
- [ ] Multi-source verification (compare multiple attestors)
- [ ] Time-weighted average outcomes (for gradual resolution)
- [ ] Dispute mechanism (before finalization)
- [ ] Gas optimization for batch submissions
- [ ] Support for additional data sources beyond UMA

---

**Questions?** Open an issue on GitHub or join our Discord.
