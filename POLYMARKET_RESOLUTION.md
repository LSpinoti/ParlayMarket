# Polymarket API Resolution Integration

This document describes the integration of Polymarket's API for market resolution instead of relying on UMA oracle data.

## Overview

The system has been updated to use Polymarket's API JSON data to determine which side a market resolved to, replacing the previous UMA-based resolution system.

## Key Changes

### 1. Contract Updates

#### Oracle Interface (`IPolymarketOracle.sol`)
- Changed from `umaId` (bytes32) to `conditionId` (bytes32)
- Functions now use Polymarket's condition ID directly
- Updated documentation to reflect API-based resolution

#### FlarePolymarketOracle (`FlarePolymarketOracle.sol`)
- Updated to store outcomes by `conditionId` instead of `umaId`
- FDC attestation now verifies Polymarket API data
- All functions (`submitOutcome`, `setOutcomeDirect`, `setOutcomesBatch`, `getOutcome`, `isResolved`) updated to use `conditionId`

#### ParlayMarket (`ParlayMarket.sol`)
- Changed `umaIds` array to `conditionIds` array in Parlay struct
- Updated all events and functions to use `conditionIds`
- Resolution logic now queries oracle with condition IDs

### 2. API Endpoints

#### New: `/api/polymarket/resolution`
Fetches resolution data for one or more markets from Polymarket API.

**Query Parameters:**
- `conditionIds`: Comma-separated list of condition IDs

**Example:**
```
GET /api/polymarket/resolution?conditionIds=0x1234...,0x5678...
```

**Response:**
```json
{
  "resolutions": [
    {
      "conditionId": "0x1234...",
      "resolved": true,
      "outcome": 1,
      "question": "Will Bitcoin reach $100k?",
      "closedDate": "2024-12-31T23:59:59Z"
    },
    {
      "conditionId": "0x5678...",
      "resolved": false,
      "outcome": 2
    }
  ]
}
```

**Outcome Values:**
- `0`: NO wins
- `1`: YES wins
- `2`: INVALID or not yet resolved

**Caching:**
- Server-side caching: 30 seconds revalidation
- Client-side caching: 30 seconds max-age, 60 seconds stale-while-revalidate

### 3. Frontend/Library Updates

#### `lib/polymarket.ts`
Added new functions and types:

**Types:**
```typescript
interface PolymarketMarket {
  // ... existing fields
  resolved?: boolean;
  resolvedBy?: string;
  resolutionTime?: string;
  winningOutcome?: string;
}

interface SimplifiedMarket {
  // ... existing fields
  resolved?: boolean;
  winningOutcome?: number; // 0 = NO, 1 = YES, 2 = INVALID
}
```

**Functions:**
- `getMarketResolution(conditionId)`: Check single market resolution
- `batchGetMarketResolutions(conditionIds[])`: Check multiple markets efficiently

**Example Usage:**
```typescript
// Check single market
const { resolved, outcome } = await getMarketResolution('0x1234...');

// Batch check multiple markets
const resolutions = await batchGetMarketResolutions([
  '0x1234...',
  '0x5678...',
  '0x9abc...'
]);
```

#### `lib/contracts.ts`
- Updated `ParlayData` interface: `umaIds` → `conditionIds`

#### `hooks/useParlays.ts`
- Updated to use `conditionIds` instead of `umaIds`

#### Component Updates
- `app/create/page.tsx`: Updated to use `conditionId` instead of `umaId`
- `app/parlay/[id]/page.tsx`: Display `conditionIds` instead of `umaIds`
- `components/ParlayCard.tsx`: Updated market count display
- `app/page.tsx`: Updated marketing copy to reference API resolution

### 4. Resolution Flow

#### How Markets are Resolved

1. **Market Closes on Polymarket**
   - Market reaches end date and closes
   - Polymarket determines winner through their resolution process

2. **Polymarket API Updated**
   - Market data is updated with resolution information
   - Winner is set on the token objects
   - Market status changes to closed

3. **Off-Chain Monitoring (Future Enhancement)**
   - A monitoring service watches for market resolutions
   - Fetches resolution data from `/api/polymarket/resolution`
   - Prepares attestation data for FDC

4. **On-Chain Submission**
   - Attestor submits outcome to `FlarePolymarketOracle`
   - FDC verifies the attestation (contains Polymarket API data)
   - Oracle stores the resolved outcome by condition ID

5. **Parlay Resolution**
   - User calls `resolveParlay()` on `ParlayMarket`
   - Contract queries oracle for each condition ID
   - Checks if all markets are resolved
   - Determines winner based on required outcomes
   - Distributes funds to winner

#### Resolution Data Flow

```
Polymarket Markets
      ↓
Polymarket API (with winner data)
      ↓
/api/polymarket/resolution (Next.js API route)
      ↓
Off-chain Monitoring Service
      ↓
FDC Attestation
      ↓
FlarePolymarketOracle (on-chain)
      ↓
ParlayMarket.resolveParlay()
      ↓
Winner receives funds
```

## Migration Guide

### For Existing Deployments

If you have existing parlays using `umaIds`:

1. **Smart Contracts**: 
   - Redeploy all contracts with updated code
   - Keep old contract for historical parlays if needed

2. **Frontend**:
   - Update to latest code
   - Old parlays will fail to load (field name mismatch)
   - Consider migration script if needed

3. **Oracle Data**:
   - No automatic migration possible
   - Must manually map old UMA IDs to condition IDs if needed

### For New Deployments

1. Deploy `FlarePolymarketOracle` with FDC verification address
2. Deploy `ParlayMarket` with oracle address
3. Set up off-chain monitoring service (see below)
4. Configure attestors on oracle contract

## Off-Chain Monitoring Service

### Requirements

You'll need a service that:

1. **Monitors Polymarket API**
   - Polls `/api/polymarket/resolution` for condition IDs of active parlays
   - Detects when markets close and resolve

2. **Prepares FDC Attestations**
   - Formats resolution data according to FDC spec
   - Obtains merkle proofs for attestation

3. **Submits to Oracle**
   - Calls `submitOutcome()` on `FlarePolymarketOracle`
   - Provides attestation data and merkle proof

### Example Service Structure

```typescript
// Pseudo-code for monitoring service
class ResolutionMonitor {
  async monitorParlays() {
    const activeParlays = await this.getActiveParlays();
    const conditionIds = this.extractConditionIds(activeParlays);
    
    // Check resolutions
    const resolutions = await fetch(
      `/api/polymarket/resolution?conditionIds=${conditionIds.join(',')}`
    );
    
    // Find newly resolved markets
    const newlyResolved = resolutions.filter(r => 
      r.resolved && !this.isAlreadySubmitted(r.conditionId)
    );
    
    // Submit to oracle via FDC
    for (const resolution of newlyResolved) {
      await this.submitToOracle(resolution);
    }
  }
  
  async submitToOracle(resolution) {
    // 1. Prepare attestation data
    const attestationData = this.prepareAttestation(resolution);
    
    // 2. Get merkle proof from FDC
    const merkleProof = await this.getMerkleProof(attestationData);
    
    // 3. Submit to oracle
    await oracle.submitOutcome(
      resolution.conditionId,
      resolution.outcome,
      attestationData,
      merkleProof
    );
  }
}
```

## Testing

### Local Testing

Use `FlarePolymarketOracle` with direct outcome setting for testing:

```solidity
// Deploy oracle with FDC address
FlarePolymarketOracle oracle = new FlarePolymarketOracle(fdcAddress);

// Set test outcomes (owner only)
bytes32[] memory conditionIds = new bytes32[](2);
conditionIds[0] = 0x1234...;
conditionIds[1] = 0x5678...;

uint8[] memory outcomes = new uint8[](2);
outcomes[0] = 1; // YES
outcomes[1] = 0; // NO

oracle.setOutcomesBatch(conditionIds, outcomes);
```

### Testing Resolution API

```bash
# Test single market
curl "http://localhost:3000/api/polymarket/resolution?conditionIds=0x123..."

# Test multiple markets
curl "http://localhost:3000/api/polymarket/resolution?conditionIds=0x123...,0x456..."
```

## Benefits of API-Based Resolution

1. **Direct Source of Truth**: Uses Polymarket's official resolution data
2. **No Intermediate Oracles**: Eliminates UMA as a middleman
3. **Faster Updates**: Can detect resolutions as soon as Polymarket updates
4. **Better Reliability**: Less dependent on external oracle infrastructure
5. **Cost Efficient**: Fewer oracle interactions needed
6. **Transparent**: Easy to verify resolution data against Polymarket

## Security Considerations

1. **FDC Verification**: All API data must be attested through Flare Data Connector
2. **Attestor Security**: Only authorized attestors can submit outcomes
3. **Data Validation**: API responses are validated for correct format
4. **Caching**: Prevents excessive API calls while maintaining freshness
5. **Error Handling**: Graceful fallbacks for API failures

## Future Enhancements

1. **Automated Monitoring**: Build production-ready monitoring service
2. **Multi-Source Verification**: Cross-check with multiple data sources
3. **Resolution Challenges**: Allow dispute period for resolutions
4. **Event Webhooks**: Subscribe to Polymarket resolution events
5. **Historical Resolution**: Support looking up past resolutions
6. **Gas Optimization**: Batch multiple resolutions in single transaction

## Support

For issues or questions:
- Check Polymarket API documentation
- Review Flare FDC documentation
- See TESTING.md for test procedures
- See FDC_INTEGRATION.md for Flare-specific details
