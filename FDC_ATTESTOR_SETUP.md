# Setting Up Your Private FDC Attestor for Polymarket Data

This guide explains how to set up your private attestor using the [Flare FDC Client](https://github.com/flare-foundation/fdc-client) to attest to Polymarket API resolution data.

## Architecture Overview

```
┌─────────────────┐
│  Polymarket API │  ← Web2 data source
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────┐
│           Your Private FDC Attestor                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  FDC Client (Go)                                 │  │
│  │  - Monitors attestation requests                 │  │
│  │  - Queries verifier server                       │  │
│  │  - Provides bit votes                            │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐  │
│  │  Verifier Server (Node.js/Go)                    │  │
│  │  - Fetches Polymarket API data                   │  │
│  │  - Validates market resolution                   │  │
│  │  - Returns attestation response                  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────┐
│  Flare Network                                          │
│  - C-Chain Indexer (reads attestation requests)        │
│  - FDC Verification Contract (validates proofs)        │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Go 1.19+** - For running the FDC client
2. **Node.js 18+** - For the verifier server
3. **MySQL/PostgreSQL** - For the C-Chain indexer (if running your own)
4. **Flare node access** - RPC endpoint for Coston2 or Flare mainnet

## Part 1: Clone and Setup FDC Client

```bash
# Clone the FDC client repository
git clone https://github.com/flare-foundation/fdc-client.git
cd fdc-client

# Build the client
go build -o fdc-client ./main
```

## Part 2: Create Polymarket Verifier Server

The FDC client needs a verifier server that can fetch and validate Polymarket API data. Create this in your project:

```bash
# In your parlaymarket directory
mkdir -p verifier-server
cd verifier-server
npm init -y
npm install express ethers dotenv
```

Create `verifier-server/index.js`:

```javascript
const express = require('express');
const { ethers } = require('ethers');
const app = express();
app.use(express.json());

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

// Verify Polymarket resolution request
app.post('/api/verify', async (req, res) => {
  try {
    const { requestBody } = req.body;
    
    // Decode the request
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const [conditionId, apiEndpoint, timestamp, expectedFields] = abiCoder.decode(
      ['bytes32', 'string', 'uint256', 'string[]'],
      requestBody
    );

    console.log(`Verifying market: ${conditionId}`);

    // Fetch from Polymarket API
    const response = await fetch(apiEndpoint, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return res.status(400).json({
        verified: false,
        error: 'API request failed'
      });
    }

    const marketData = await response.json();

    // Determine outcome
    let outcome = 2; // INVALID
    if (marketData.closed && marketData.tokens) {
      const yesToken = marketData.tokens.find(t => 
        t.outcome?.toLowerCase() === 'yes'
      );
      const noToken = marketData.tokens.find(t => 
        t.outcome?.toLowerCase() === 'no'
      );

      if (yesToken?.winner === true) outcome = 1;
      else if (noToken?.winner === true) outcome = 0;
    }

    // Check explicit winning outcome
    if (outcome === 2 && marketData.winningOutcome) {
      const winningOutcome = marketData.winningOutcome.toLowerCase();
      if (winningOutcome === 'yes') outcome = 1;
      else if (winningOutcome === 'no') outcome = 0;
    }

    // Create response hash
    const responseData = {
      conditionId,
      closed: marketData.closed,
      outcome,
      question: marketData.question,
      resolvedAt: Date.now()
    };

    const dataHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(responseData))
    );

    // Encode response
    const responseBody = abiCoder.encode(
      ['bytes32', 'bool', 'uint8', 'uint256', 'string', 'bytes32'],
      [
        conditionId,
        marketData.closed,
        outcome,
        BigInt(Math.floor(Date.now() / 1000)),
        marketData.question || '',
        dataHash
      ]
    );

    res.json({
      verified: true,
      responseBody,
      outcome,
      closed: marketData.closed
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      verified: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Polymarket verifier server running on port ${PORT}`);
});
```

Start the verifier server:

```bash
cd verifier-server
node index.js
```

## Part 3: Configure FDC Client

Create a configuration file `fdc-client/configs/userConfig.toml`:

```toml
# Network configuration
chain = "coston2"  # or "flare" for mainnet
protocol_id = 100  # Custom protocol ID for your attestor

# Database configuration (C-Chain Indexer)
[db]
host = "localhost"
port = 3306
database = "flare_ftso_indexer"
username = "root"
password = "root"
log_queries = false

# REST server configuration
[rest_server]
addr = ":8080"
api_key_name = "X-API-KEY"
api_keys = ["your-secure-api-key-here"]
title = "Polymarket FDC Attestor API"
fsp_sub_router_title = "FDC protocol data provider for FSP client"
fsp_sub_router_path = "/fsp"
da_sub_router_title = "DA endpoints"
da_sub_router_path = "/da"
version = "0.0.0"
swagger_path = "/api-doc"

# Polymarket API attestation type
[verifiers.PolymarketAPI]
abi_path = "configs/abis/polymarket.json"

# Polymarket source configuration
[verifiers.PolymarketAPI.Sources.PolymarketGamma]
url = "http://localhost:3001/api/verify"  # Your verifier server
api_key = "your-verifier-api-key"
lut_limit = "86400"  # 24 hours in seconds
queue = "polymarket_queue"

# Queue configuration
[queue.polymarket_queue]
max_dequeues_per_second = 10
max_workers = 5
max_attempts = 3
time_off = "2s"
```

## Part 4: Create ABI Configuration

Create `fdc-client/configs/abis/polymarket.json`:

```json
{
  "type": "tuple",
  "components": [
    {
      "name": "conditionId",
      "type": "bytes32"
    },
    {
      "name": "closed",
      "type": "bool"
    },
    {
      "name": "outcome",
      "type": "uint8"
    },
    {
      "name": "resolvedAt",
      "type": "uint256"
    },
    {
      "name": "question",
      "type": "string"
    },
    {
      "name": "apiDataHash",
      "type": "bytes32"
    }
  ]
}
```

## Part 5: Setup C-Chain Indexer (Optional)

If you want to run your own indexer:

```bash
# Clone the indexer
git clone https://github.com/flare-foundation/flare-indexer.git
cd flare-indexer

# Configure for Coston2
cp .env.example .env
# Edit .env with your configuration

# Run with Docker
docker-compose up -d
```

Or use a public indexer endpoint (check [Flare Documentation](https://dev.flare.network)).

## Part 6: Run the FDC Client

```bash
cd fdc-client

# Run the client
./fdc-client --config configs/userConfig.toml
```

The client will:
1. Connect to C-Chain indexer
2. Monitor for attestation requests
3. Query your verifier server when requests come in
4. Provide bit votes for consensus
5. Publish Merkle roots to Flare

## Part 7: Submit Attestation Requests

From your ParlayMarket app, when the "Resolve Parlay" button is clicked:

```typescript
// In your frontend
const response = await fetch('/api/fdc/request-attestation', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conditionIds: ['0xabc123...'],
    network: 'coston2'
  })
});
```

This will:
1. Create attestation requests for the condition IDs
2. Submit to FDC Hub contract
3. Your attestor picks up the requests
4. Verifies the data via your verifier server
5. Participates in consensus
6. After finalization, you can submit to the oracle with proof

## Part 8: Submit Verified Data to Oracle

After FDC attestation is finalized:

```typescript
// Get attestation data and proof from FDC
const { attestationData, merkleProof } = await getAttestationFromFDC(requestId);

// Submit to oracle
const oracle = new ethers.Contract(oracleAddress, oracleABI, signer);
await oracle.submitOutcome(
  conditionId,
  outcome,
  attestationData,
  merkleProof
);
```

## Testing Mode (Without Full FDC)

For development and testing, you can use direct oracle submission:

```typescript
// Current implementation (testing mode)
const { submitResolutionsToOracle } = await import('@/lib/fdc-client');
await submitResolutionsToOracle(conditionIds, signer, 'coston2');
```

This bypasses FDC and submits directly to the oracle using `setOutcomesBatch()`.

## Production Checklist

- [ ] FDC client running and connected to C-Chain indexer
- [ ] Verifier server running and accessible
- [ ] Configuration file properly set up
- [ ] Oracle contract has your attestor address authorized
- [ ] Monitoring and logging set up
- [ ] Backup attestor nodes (for redundancy)
- [ ] Alert system for failed attestations
- [ ] Regular database backups (if running own indexer)

## Monitoring Your Attestor

Check the FDC client logs for:
- ✅ Attestation requests received
- ✅ Verifications completed
- ✅ Bit votes submitted
- ✅ Merkle roots published
- ❌ Verification failures
- ❌ Network connectivity issues

Monitor the verifier server for:
- API request counts
- Success/failure rates
- Response times
- Polymarket API availability

## Troubleshooting

### "Cannot connect to C-Chain indexer"
- Check database credentials in config
- Ensure indexer is running
- Verify network connectivity

### "Verifier server not responding"
- Check verifier server is running on correct port
- Verify URL in FDC client config
- Check firewall rules

### "Attestation verification failed"
- Ensure Polymarket API is accessible
- Check ABI encoding matches contract expectations
- Verify Merkle proof generation

### "Not authorized to submit to oracle"
- Add your attestor address: `oracle.addAttestor(address)`
- Ensure you're using the correct signer

## Resources

- [Flare FDC Documentation](https://dev.flare.network/fdc/overview)
- [FDC Client GitHub](https://github.com/flare-foundation/fdc-client)
- [Polymarket API Documentation](https://docs.polymarket.com/)
- [ParlayMarket Documentation](./README.md)

## Advanced: Running Multiple Attestors

For production, consider running multiple attestor nodes for redundancy:

1. Deploy multiple FDC clients with same config
2. Each connects to the same verifier server
3. They independently verify and vote
4. Consensus is reached across all attestors

This provides:
- High availability
- Byzantine fault tolerance
- Increased trust in attestations

---

**Need help?** Open an issue or contact the Flare community on [Discord](https://discord.com/invite/flarenetwork).
