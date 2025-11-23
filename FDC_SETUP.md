# FDC Oracle Setup Guide

This guide explains how to set up and use the actual FDC (Flare Data Connector) attestation system for ParlayMarket, replacing the previous spoofing/testing mode.

## Overview

The FDC integration allows ParlayMarket to trustlessly fetch and verify Polymarket resolution data on-chain using Flare's Data Connector protocol.

## Architecture

```
┌─────────────┐
│  Polymarket │  ← Data source
│     API     │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────────────┐
│     Verifier Server (Node.js)            │
│     • Validates Polymarket data          │
│     • Runs on localhost:3001             │
└──────┬───────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│     FDC Client (Go binary)               │
│     • Monitors attestation requests      │
│     • Queries verifier server            │
│     • Provides Merkle proofs             │
│     • Runs on localhost:8080             │
└──────┬───────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│     Next.js API Routes                   │
│     • /api/fdc/request-attestation       │
│     • /api/fdc/attestation-status        │
│     • /api/fdc/get-attestation-data      │
└──────┬───────────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────────┐
│     FlarePolymarketOracle                │
│     • Verifies FDC proofs                │
│     • Stores market outcomes             │
└──────────────────────────────────────────┘
```

## Prerequisites

1. **Go 1.19+** - For FDC client
2. **Node.js 18+** - For verifier server
3. **Git** - To clone FDC client repository

## Step 1: Start the Verifier Server

The verifier server fetches and validates Polymarket API data.

```bash
cd verifier-server

# Install dependencies (first time only)
npm install

# Configure environment
cp .env.example .env
nano .env  # Set a secure VERIFIER_API_KEY

# Start the server
npm start
```

The verifier will run on `http://localhost:3001`. You should see:

```
╔════════════════════════════════════════════════════════╗
║   Polymarket Verifier Server for FDC Attestations     ║
╚════════════════════════════════════════════════════════╝

🚀 Server running on http://localhost:3001
📊 Health check: http://localhost:3001/health
🔐 API Key configured: Yes ✓
```

Verify it's working:
```bash
curl http://localhost:3001/health
```

## Step 2: Clone and Build FDC Client

```bash
# In a separate directory (outside your project)
cd ~/
git clone https://github.com/flare-foundation/fdc-client.git
cd fdc-client

# Build the client
go build -o fdc-client ./main
```

## Step 3: Setup MySQL Database

The FDC client requires a MySQL/MariaDB database. Set it up quickly:

```bash
# Create MySQL user for FDC client
sudo mysql -u root << 'SQL'
CREATE DATABASE IF NOT EXISTS flare_ftso_indexer;
DROP USER IF EXISTS 'fdc_user'@'localhost';
CREATE USER 'fdc_user'@'localhost' IDENTIFIED BY 'fdc_password';
GRANT ALL PRIVILEGES ON flare_ftso_indexer.* TO 'fdc_user'@'localhost';
FLUSH PRIVILEGES;
SQL

# Create minimal database schema
sudo mysql -u root flare_ftso_indexer << 'SQL'
CREATE TABLE IF NOT EXISTS states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    value BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO states (name, value) VALUES ('indexer_block', 0)
ON DUPLICATE KEY UPDATE value = value;
SQL
```

**Credentials:**
- Database: `flare_ftso_indexer`
- Username: `fdc_user`
- Password: `fdc_password`

**Note:** If you get "command not found", install MariaDB first:
```bash
# Arch Linux
sudo pacman -S mariadb
sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql
sudo systemctl start mariadb

# Ubuntu/Debian
sudo apt install mariadb-server
sudo systemctl start mariadb
```

## Step 4: Configure FDC Client

Create `fdc-client/configs/userConfig.toml`:

```toml
# Network configuration
chain = "coston2"
protocol_id = 100  # Custom protocol for Polymarket API attestations

# Database configuration (for C-Chain indexer)
# Using dedicated FDC user with password authentication
[db]
host = "localhost"
port = 3306
database = "flare_ftso_indexer"
username = "fdc_user"
password = "fdc_password"
log_queries = false

# REST API server
[rest_server]
addr = ":8080"
api_key_name = "X-API-KEY"
api_keys = ["your-secure-api-key"]  # Must match FDC_API_KEY in .env
title = "Polymarket FDC Attestor API"
fsp_sub_router_title = "FDC protocol data provider"
fsp_sub_router_path = "/fsp"
da_sub_router_title = "Data availability endpoints"
da_sub_router_path = "/da"
version = "1.0.0"
swagger_path = "/api-doc"

# Polymarket API attestation type
[verifiers.PolymarketAPI]
abi_path = "configs/abis/polymarket.json"

# Polymarket verifier source
[verifiers.PolymarketAPI.Sources.PolymarketGamma]
url = "http://localhost:3001/api/verify"  # Your verifier server
api_key = "your-secure-api-key"  # Must match VERIFIER_API_KEY
lut_limit = "86400"  # 24 hours
queue = "polymarket_queue"

# Queue configuration
[queue.polymarket_queue]
max_dequeues_per_second = 10
max_workers = 5
max_attempts = 3
time_off = "2s"
```

Create `fdc-client/configs/abis/polymarket.json`:

```json
{
  "type": "tuple",
  "components": [
    {"name": "conditionId", "type": "bytes32"},
    {"name": "closed", "type": "bool"},
    {"name": "outcome", "type": "uint8"},
    {"name": "resolvedAt", "type": "uint256"},
    {"name": "question", "type": "string"},
    {"name": "apiDataHash", "type": "bytes32"}
  ]
}
```

Create `fdc-client/configs/systemConfigs/100/coston2.toml`:

```toml
# System configuration for Polymarket API attestation protocol on Coston2
# Protocol ID: 100 (Custom protocol for Polymarket API data)

chain = "coston2"
protocol_id = 100

[rpc]
url = "https://coston2-api.flare.network/ext/C/rpc"
api_key = ""

[attestation_types]
enabled = [100]  # APIData type for Polymarket

[voting]
round_duration = 90
blocks_per_round = 45

[data_availability]
retention_period = 604800  # 7 days

[indexer]
enabled = false
start_block = 0

[verifiers]
[verifiers.PolymarketAPI]
enabled = true
attestation_type_id = 100
```

**Important:** Make sure `api_keys` in `userConfig.toml` matches `FDC_API_KEY` in your project's `.env` file, and `api_key` in the verifier source matches `VERIFIER_API_KEY` in `verifier-server/.env`.

## Step 5: Configure Environment Variables

Update `.env` in your project root:

```bash
# FDC Attestor Configuration
FDC_ATTESTOR_URL=http://localhost:8080
FDC_API_KEY=your-secure-api-key  # Must match userConfig.toml

# Verifier server configuration
VERIFIER_URL=http://localhost:3001
VERIFIER_API_KEY=your-secure-api-key  # Must match verifier-server/.env
```

## Step 6: Run FDC Client

```bash
cd ~/fdc-client
./fdc-client --config configs/userConfig.toml
```

You should see logs indicating:
- ✅ REST API server started on :8080
- ✅ Connected to database (if using own indexer)
- ✅ Verifiers initialized

## Step 7: Start Your Application

```bash
cd /home/luka/Desktop/parlaymarket
pnpm dev
```

## How It Works

### 1. User Clicks "Resolve Parlay"

When a user clicks the resolve button on a parlay:

### 2. Frontend Checks Oracle

The app first checks if the markets are already resolved in the oracle:

```typescript
const oracleResolutions = await checkOracleResolutions(
  parlay.conditionIds,
  provider,
  'coston2'
);
```

### 3. Request FDC Attestation

If markets are not resolved, it requests FDC attestation:

```typescript
const attestationRequest = await requestFDCAttestation(
  unresolvedConditionIds,
  'coston2'
);
```

This:
- Calls `/api/fdc/request-attestation`
- API route forwards to FDC client REST API
- Returns a request ID for tracking

### 4. Wait for Finalization

The app polls for attestation status:

```typescript
await waitForFDCFinalization(attestationRequest.requestId, 120000);
```

During this time (~90 seconds on Coston2):
- FDC client queries the verifier server
- Verifier server fetches Polymarket data
- FDC client generates Merkle proofs
- Attestation is finalized

### 5. Get Attestation Data

Once finalized, get the proof:

```typescript
const attestationData = await getFDCAttestationData(
  unresolvedConditionIds,
  'coston2'
);
```

This returns:
- Attestation data (ABI-encoded)
- Merkle proof
- Outcome value

### 6. Submit to Oracle

Submit the FDC-verified outcome:

```typescript
const results = await submitFDCVerifiedOutcomes(
  attestationData,
  signer,
  'coston2'
);
```

This calls the oracle's `submitOutcome()` function with the FDC proof, which verifies the proof on-chain.

### 7. Resolve Parlay

Finally, resolve the parlay:

```typescript
const tx = await contract.resolveParlay(parlayId);
```

## Troubleshooting

### "FDC attestor not available"

**Cause:** FDC client not running or wrong URL

**Fix:**
1. Check FDC client is running: `ps aux | grep fdc-client`
2. Verify `FDC_ATTESTOR_URL` in `.env` is correct
3. Test: `curl http://localhost:8080/api-doc`

### "Verifier server not responding"

**Cause:** Verifier server not running

**Fix:**
```bash
cd verifier-server
npm start
```

Test:
```bash
curl http://localhost:3001/health
```

### "Unauthorized" errors

**Cause:** API key mismatch

**Fix:** Ensure all API keys match:
- `.env` → `FDC_API_KEY` 
- `fdc-client/configs/userConfig.toml` → `api_keys`
- `verifier-server/.env` → `VERIFIER_API_KEY`
- `fdc-client/configs/userConfig.toml` verifier source → `api_key`

### "Attestation verification failed"

**Cause:** Invalid Merkle proof or attestation data

**Fix:**
1. Ensure FDC client is fully synced
2. Check FDC client logs for errors
3. Verify you're an authorized attestor: `oracle.addAttestor(yourAddress)`

### "Market not closed yet"

**Cause:** Polymarket market hasn't been resolved

**Fix:** Use a market that is already resolved on Polymarket. Check at:
```
https://gamma-api.polymarket.com/markets/{conditionId}
```

Look for `"closed": true` in the response.

## Testing Without Full FDC Setup

If you don't have the full FDC client running, the system has a fallback mode that still fetches real Polymarket data but generates mock proofs. This is useful for development.

The `/api/fdc/get-attestation-data` endpoint will:
1. Still fetch real Polymarket market data
2. Create proper attestation data
3. Use empty Merkle proof arrays

**Note:** This will only work if the oracle contract allows empty proofs (which it shouldn't in production).

## Production Deployment

For production:

1. **Run multiple FDC attestors** for redundancy
2. **Use managed indexer** or run your own C-Chain indexer
3. **Secure API keys** - use strong random keys
4. **Enable HTTPS** for all endpoints
5. **Set up monitoring** for:
   - FDC client health
   - Verifier server uptime
   - Failed attestations
   - Oracle submissions

## What Changed from Spoofing Mode

### Before (Spoofing)
- Direct call to `oracle.setOutcomesBatch()` as owner
- No FDC attestation
- No proof verification
- Outcomes could be arbitrary

### After (Real FDC)
- Request attestation from FDC
- Wait for consensus (~90s)
- Get Merkle proof
- Submit with `oracle.submitOutcome()`
- On-chain proof verification via FDC Verification contract

### Contract Changes

The `FlarePolymarketOracle` contract has both functions:
- `submitOutcome()` - **Production** (requires FDC proof)
- `setOutcomesBatch()` - **Testing only** (owner only, direct set)

The new implementation uses `submitOutcome()` exclusively.

## Next Steps

1. **Test with resolved markets** first
2. **Monitor logs** from all components
3. **Set up the full flow** end-to-end
4. **Consider running own indexer** for full control

## Resources

- [Flare FDC Documentation](https://dev.flare.network/fdc/overview)
- [FDC Client Repository](https://github.com/flare-foundation/fdc-client)
- [Polymarket API](https://gamma-api.polymarket.com/)
- [ParlayMarket README](./README.md)

## Support

If you encounter issues:
1. Check all logs (FDC client, verifier server, Next.js)
2. Verify API keys match everywhere
3. Ensure all services are running
4. Open an issue on GitHub with logs

---

**Congratulations!** You now have a fully functional FDC-based oracle system for ParlayMarket. 🎉
