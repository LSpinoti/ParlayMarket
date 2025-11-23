# Simplified FDC Setup (Without Full Indexer)

The full FDC client requires a complete C-Chain indexer database, which is complex to set up for local development. Here's a simplified approach that still uses **real Polymarket data** with proper attestation structure.

## The Issue

The official FDC client (`fdc-client`) expects:
- Full C-Chain indexer database with complete blockchain data
- Multiple database tables for transaction tracking
- Continuous blockchain synchronization

This is overkill for API-based attestations like Polymarket data.

## Simplified Solution

We've already implemented the FDC attestation flow in the code:
1. ✅ Frontend requests attestation
2. ✅ API routes fetch real Polymarket data
3. ✅ Verifier server validates the data
4. ✅ Attestation data is properly encoded
5. ✅ Oracle verification (uses `submitOutcome` with proof)

### What's Missing?

Just the Merkle proof generation, which the full FDC client would provide after consensus.

## Two Options

### Option 1: Development Mode (Recommended for Testing)

Use the existing fallback mode that fetches **real Polymarket data** but generates empty proofs:

**How it works:**
1. User clicks "Resolve Parlay"
2. System checks oracle for existing resolutions
3. If not resolved:
   - Fetches **real** Polymarket API data
   - Creates proper attestation structure
   - Uses empty Merkle proof (for development)
   - Submits to oracle

**Current Implementation:**
- `/api/fdc/get-attestation-data` already does this
- Falls back to mock proofs when FDC client unavailable
- Still fetches and validates **real** market data

**To Enable:**
Simply don't run the FDC client. The system will automatically use this fallback mode with helpful error messages.

**Limitations:**
- Empty Merkle proofs won't work on production oracle (by design)
- Good for testing the full flow with real data
- Oracle contract must allow empty proofs (testing mode)

### Option 2: Full FDC Setup (Production)

For production deployment with full verification:

1. **Use a public C-Chain indexer** (when available)
2. **Run your own indexer:**
   ```bash
   git clone https://github.com/flare-foundation/flare-indexer.git
   cd flare-indexer
   docker-compose up -d
   ```
3. **Configure FDC client to use the indexer**

## Quick Start (Development Mode)

### 1. Start Verifier Server

```bash
cd verifier-server
npm install
npm start
```

This runs on port 3001 and validates Polymarket data.

### 2. Update Environment

Ensure `.env` has:
```bash
VERIFIER_URL=http://localhost:3001
VERIFIER_API_KEY=your-secure-api-key
```

### 3. Start Your App

```bash
pnpm dev
```

### 4. Test Resolution

1. Create a parlay with resolved markets
2. Fill the parlay
3. Click "Resolve Parlay"

**What happens:**
- Checks oracle for existing resolutions
- Fetches **real** Polymarket data via `/api/polymarket/resolution`
- Creates attestation with proper encoding
- Shows helpful message if FDC client not available
- For development: uses fallback with empty proof

## For Production

When ready for production:

1. **Setup full C-Chain indexer** (see `FDC_SETUP.md`)
2. **Run FDC client** with full configuration
3. **Configure oracle** to require valid Merkle proofs
4. **Authorize your attestor** address on the oracle contract

## What's Real vs Mock?

### Always Real ✅
- Polymarket API data fetching
- Market resolution status
- Outcome determination (YES/NO/INVALID)
- Attestation data encoding
- Oracle contract calls

### Development Mode Only 🔧
- Empty Merkle proof arrays
- No FDC consensus process
- No on-chain proof verification

The data is **100% real**, only the cryptographic proof is simplified for development.

## Testing with Real Data

You can test the full flow with real resolved markets:

1. Find a resolved market on Polymarket
2. Get its `conditionId` from the URL
3. Create a parlay with that market
4. The system will fetch real resolution data
5. Encode it properly for the oracle
6. Submit with development proofs

## Architecture Comparison

### Full FDC (Production)
```
Frontend → API → FDC Client → Verifier Server → Polymarket API
                     ↓
                 C-Chain Indexer (Database)
                     ↓
                 Merkle Proof Generation
                     ↓
                 Oracle (with proof verification)
```

### Simplified (Development)
```
Frontend → API → Verifier Server → Polymarket API
              ↓
          Attestation Encoding
              ↓
          Oracle (development mode)
```

Both fetch **real Polymarket data**. The difference is proof generation and verification.

## Migration Path

1. **Start**: Use simplified mode for development
2. **Test**: Verify all data fetching and encoding works
3. **Prepare**: Set up C-Chain indexer when ready
4. **Deploy**: Switch to full FDC with proof verification
5. **Production**: Run multiple FDC attestors for redundancy

## Current Status

Your implementation is **production-ready** except for:
- Merkle proof generation (requires full FDC client)
- On-chain proof verification (requires oracle configuration)

Everything else works with **real Polymarket data**:
- ✅ API integration
- ✅ Data validation
- ✅ Attestation encoding
- ✅ Oracle submission structure
- ✅ Resolution flow

## Next Steps

**For Development:**
1. Use the simplified mode (no FDC client needed)
2. Test with real resolved markets
3. Verify data fetching and encoding

**For Production:**
1. Review `FDC_SETUP.md` for full setup
2. Consider using managed indexer service
3. Deploy multiple FDC attestor nodes
4. Configure oracle for proof verification

## Summary

You don't need the full FDC client setup to test with **real Polymarket data**. The simplified mode:
- ✅ Fetches real market data
- ✅ Validates resolution status
- ✅ Encodes attestation properly
- ✅ Tests the full flow
- 🔧 Uses simplified proofs for development

When ready for production, add the FDC client and indexer for full cryptographic verification.

---

**Questions?** Check `FDC_SETUP.md` for full FDC setup, or continue with simplified mode for development.

