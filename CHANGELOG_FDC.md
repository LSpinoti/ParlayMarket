# FDC Implementation Changelog

## Summary

Removed FDC/Oracle spoofing and implemented actual FDC attestation with local FDC oracle integration.

## Changes Made

### 1. Updated `lib/fdc-client.ts`

**Removed:**
- `submitResolutionsToOracle()` - Direct oracle submission (spoofing)

**Added:**
- `requestFDCAttestation()` - Request attestation from local FDC attestor
- `waitForFDCFinalization()` - Poll attestation status until finalized
- `getFDCAttestationData()` - Retrieve attestation data with Merkle proofs
- `submitFDCVerifiedOutcomes()` - Submit FDC-verified outcomes to oracle with proofs

**Key Changes:**
- Now uses REST API calls to local FDC attestor (default: `http://localhost:8080`)
- Proper attestation flow with proof verification
- Uses `oracle.submitOutcome()` instead of `oracle.setOutcomesBatch()`

### 2. Updated API Routes

#### `app/api/fdc/request-attestation/route.ts`

**Before:**
- Prepared attestation requests but didn't submit
- Returned placeholder data

**After:**
- Actually submits to local FDC attestor REST API
- Calls `${FDC_ATTESTOR_URL}/fsp/prepare-request`
- Returns real request ID for tracking
- Proper error handling for FDC unavailability

#### New: `app/api/fdc/attestation-status/[requestId]/route.ts`

- Polls FDC attestor for attestation status
- Returns 'pending', 'finalized', or 'failed'
- Used by frontend to wait for attestation completion

#### New: `app/api/fdc/get-attestation-data/route.ts`

- Fetches finalized attestation data from FDC
- Gets Merkle proofs for verification
- Falls back to mock proofs if FDC unavailable (for testing)
- Fetches real Polymarket data

#### Updated: `app/api/fdc/submit-to-oracle/route.ts`

- Kept for backward compatibility
- Now properly documents that it's for testing only

### 3. Updated Frontend

#### `app/parlay/[id]/page.tsx` - `handleResolve()`

**Before:**
```typescript
// Check oracle
// If not resolved → Call setOutcomesBatch() directly (spoofing)
// Resolve parlay
```

**After:**
```typescript
// Check oracle
// If not resolved:
//   → Request FDC attestation
//   → Wait for finalization (~90s)
//   → Get attestation data with proofs
//   → Submit to oracle with submitOutcome()
// Resolve parlay
```

**Key Changes:**
- Uses new FDC flow with proper waiting
- Shows progress messages to user
- Helpful error messages for FDC setup issues
- Calls `submitOutcome()` with FDC proof instead of `setOutcomesBatch()`

### 4. Environment Variables

#### New `.env` variables:

```bash
# FDC Attestor Configuration
FDC_ATTESTOR_URL=http://localhost:8080
FDC_API_KEY=your-secure-api-key

# Verifier server configuration
VERIFIER_URL=http://localhost:3001
VERIFIER_API_KEY=your-secure-api-key
```

#### New `.env.example`:

- Template for environment configuration
- Clear documentation of required variables

### 5. Verifier Server

#### `verifier-server/index.js`

**Status:** Already properly implemented ✅

- Has proper API key authentication
- Fetches real Polymarket data
- Validates and encodes attestation responses
- No changes needed

### 6. Documentation

#### New: `FDC_SETUP.md`

Comprehensive setup guide covering:
- Architecture overview
- Step-by-step FDC client setup
- Configuration examples
- Troubleshooting
- How the full flow works

#### Updated: Existing docs remain valid

- `FDC_INTEGRATION.md`
- `FDC_QUICKSTART.md`
- `FDC_ATTESTOR_SETUP.md`

## Migration Guide

### For Development

1. **Start Verifier Server:**
   ```bash
   cd verifier-server
   npm install
   npm start
   ```

2. **Clone and Configure FDC Client:**
   ```bash
   git clone https://github.com/flare-foundation/fdc-client.git
   cd fdc-client
   go build -o fdc-client ./main
   # Configure userConfig.toml (see FDC_SETUP.md)
   ```

3. **Update Environment:**
   ```bash
   cp .env.example .env
   # Edit FDC_API_KEY and VERIFIER_API_KEY
   ```

4. **Start FDC Client:**
   ```bash
   ./fdc-client --config configs/userConfig.toml
   ```

5. **Start Application:**
   ```bash
   pnpm dev
   ```

### For Testing Without FDC

If you don't have FDC client running, the system will:
- Show helpful error messages
- Explain what needs to be set up
- Provide fallback with mock proofs (for development)

### For Production

1. Set up multiple FDC attestor nodes
2. Use secure, unique API keys
3. Enable HTTPS for all endpoints
4. Set up monitoring and alerts
5. Authorize attestor addresses on oracle contract

## API Flow Comparison

### Before (Spoofing)

```
User clicks "Resolve"
    ↓
Check oracle
    ↓
If not resolved:
  → Call setOutcomesBatch() as owner
    ↓
Resolve parlay
```

### After (Real FDC)

```
User clicks "Resolve"
    ↓
Check oracle
    ↓
If not resolved:
  → Request FDC attestation
  → POST /api/fdc/request-attestation
    → FDC attestor REST API
      → Verifier server queries Polymarket
        → FDC consensus
          ↓
  → Poll: GET /api/fdc/attestation-status/:id
    (every 5s for up to 2 minutes)
          ↓
  → Get attestation data
  → POST /api/fdc/get-attestation-data
    → Returns attestation + Merkle proof
          ↓
  → Submit to oracle
  → oracle.submitOutcome(conditionId, outcome, attestationData, merkleProof)
    → FDC verification contract verifies proof on-chain ✓
          ↓
Resolve parlay
```

## Smart Contract Usage

### Before

```solidity
// Owner-only direct setting (spoofing)
oracle.setOutcomesBatch(conditionIds, outcomes);
```

### After

```solidity
// FDC-verified submission with proof
oracle.submitOutcome(
  conditionId,
  outcome,
  attestationData,  // ABI-encoded FDC attestation
  merkleProof       // Merkle proof for verification
);
```

## Security Improvements

1. **On-chain Verification:** Outcomes are now verified by FDC Verification contract
2. **Decentralized Consensus:** Multiple attestors reach consensus
3. **Cryptographic Proofs:** Merkle proofs verify data authenticity
4. **Trustless:** No need to trust oracle owner
5. **Auditable:** All attestations traceable on-chain

## Testing Checklist

- [ ] Verifier server running on port 3001
- [ ] FDC client running on port 8080
- [ ] API keys match in all configs
- [ ] Can request attestation via API
- [ ] Attestation status polling works
- [ ] Can retrieve attestation data
- [ ] Oracle submission with proof succeeds
- [ ] Full resolve flow works end-to-end

## Known Limitations

1. **FDC Client Setup:** Requires Go and proper configuration
2. **Finalization Time:** ~90 seconds on Coston2
3. **Indexer Required:** FDC client needs C-Chain indexer access
4. **Testing Fallback:** Mock proofs won't work on production oracle

## Future Enhancements

- [ ] Automatic retry on attestation failure
- [ ] Better progress UI during finalization
- [ ] Batch attestation for multiple parlays
- [ ] Cache attestation data to avoid re-requesting
- [ ] Health check dashboard for FDC components

## Support

For issues:
1. Check `FDC_SETUP.md` for setup instructions
2. Review logs from all components
3. Verify API keys match
4. Ensure all services are running

---

**Migration Complete!** The system now uses real FDC attestation instead of spoofing. 🎉
