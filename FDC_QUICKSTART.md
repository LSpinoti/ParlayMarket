# FDC Integration Quick Start

This guide gets you up and running with Flare Data Connector integration for Polymarket resolution data attestation.

## 🎯 What You're Building

A system where:
1. User clicks "Resolve Parlay" button
2. Your private attestor fetches Polymarket API data
3. Data is attested through Flare Data Connector
4. Verified data is submitted to FlarePolymarketOracle
5. Parlay resolves automatically with verified outcomes

## 📋 Current Status

✅ **Already Implemented:**
- FlarePolymarketOracle contract with FDC verification
- FDC types and encoding utilities
- Frontend integration with resolve flow
- API endpoints for attestation requests
- Verifier server for Polymarket API

🔄 **Testing Mode (Current):**
The "Resolve Parlay" button currently works by:
1. Fetching Polymarket API data directly
2. Submitting to oracle using `setOutcomesBatch()` (owner only)
3. Resolving the parlay

This bypasses FDC for quick testing.

🎯 **Production Mode (Full FDC):**
Once you set up your private attestor, it will:
1. Monitor for attestation requests
2. Verify Polymarket data through your verifier server
3. Participate in FDC consensus
4. Provide Merkle proofs for oracle submission

## 🚀 Quick Start (Testing Mode)

### 1. Start Your Development Server

```bash
cd /home/luka/Desktop/parlaymarket
pnpm dev
```

### 2. Test Resolution (Direct Mode)

1. Create a parlay with some markets
2. Fill the parlay
3. Wait for markets to resolve on Polymarket
4. Click "Resolve Parlay"

The system will automatically:
- Check oracle for existing resolutions
- Fetch from Polymarket API
- Submit to oracle (requires owner wallet)
- Resolve the parlay

**Note:** You must be the oracle owner to use direct submission mode.

## 🔧 Setup Production FDC Attestor

### Step 1: Install Verifier Server

```bash
cd /home/luka/Desktop/parlaymarket/verifier-server

# Install dependencies
npm install

# Configure
cp .env.example .env
nano .env  # Set secure VERIFIER_API_KEY

# Start server
npm start
```

The verifier server will run on `http://localhost:3001` and handle Polymarket API verification requests.

### Step 2: Clone and Setup FDC Client

```bash
# In a new directory
git clone https://github.com/flare-foundation/fdc-client.git
cd fdc-client

# Build
go build -o fdc-client ./main
```

### Step 3: Configure FDC Client

Create `fdc-client/configs/userConfig.toml`:

```toml
chain = "coston2"
protocol_id = 100

[db]
host = "localhost"
port = 3306
database = "flare_ftso_indexer"
username = "root"
password = "root"

[verifiers.PolymarketAPI]
abi_path = "configs/abis/polymarket.json"

[verifiers.PolymarketAPI.Sources.PolymarketGamma]
url = "http://localhost:3001/api/verify"
api_key = "your-secure-api-key"  # Match .env
lut_limit = "86400"
queue = "polymarket_queue"

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

### Step 4: Setup C-Chain Indexer (or use public endpoint)

**Option A: Use Public Indexer** (Easier)
- Check [Flare Docs](https://dev.flare.network) for public indexer endpoints
- Update your FDC config to use public endpoint

**Option B: Run Your Own** (More control)
```bash
git clone https://github.com/flare-foundation/flare-indexer.git
cd flare-indexer
# Follow indexer setup instructions
docker-compose up -d
```

### Step 5: Start FDC Client

```bash
cd fdc-client
./fdc-client --config configs/userConfig.toml
```

Monitor logs for:
- ✅ Connection to indexer
- ✅ Attestation requests received
- ✅ Verifications completed
- ✅ Bit votes submitted

### Step 6: Authorize Your Attestor

```bash
# In Hardhat console
npx hardhat console --network coston2

> const oracle = await ethers.getContractAt(
    "FlarePolymarketOracle", 
    "YOUR_ORACLE_ADDRESS"
  );
> await oracle.addAttestor("YOUR_ATTESTOR_ADDRESS");
```

## 🧪 Testing the Full Flow

### 1. Create Test Parlay

```bash
# In your app
1. Go to /create
2. Add some Polymarket markets
3. Set stakes
4. Create parlay
```

### 2. Fill Parlay

```bash
# With a different wallet
1. Go to /parlay/[id]
2. Click "Fill Parlay"
3. Confirm transaction
```

### 3. Wait for Resolution

Wait for the Polymarket markets to resolve (or use test markets that are already resolved).

### 4. Resolve with FDC

Click "Resolve Parlay". The system will:

**Testing Mode** (if FDC not set up):
1. Fetch Polymarket data
2. Submit directly to oracle
3. Resolve parlay

**Production Mode** (with FDC running):
1. Request FDC attestation
2. Your attestor verifies data
3. Wait for consensus (~90s on Coston2)
4. Submit with Merkle proof
5. Resolve parlay

## 📊 Monitoring

### Verifier Server Logs
```bash
cd verifier-server
npm start

# Watch logs for:
# - Verification requests
# - API calls to Polymarket
# - Outcomes determined
```

### FDC Client Logs
```bash
./fdc-client --config configs/userConfig.toml

# Watch for:
# - Attestation requests
# - Verification results
# - Bit votes
# - Merkle roots
```

### Oracle Events
Monitor on-chain events:
```javascript
oracle.on('OutcomeVerified', (conditionId, outcome, timestamp, attestor) => {
  console.log('Outcome verified:', {
    conditionId,
    outcome: outcome === 0 ? 'NO' : outcome === 1 ? 'YES' : 'INVALID',
    timestamp,
    attestor
  });
});
```

## 🔍 Debugging

### "Cannot connect to indexer"
```bash
# Check database
mysql -u root -p flare_ftso_indexer
# or use public indexer endpoint
```

### "Verifier server not responding"
```bash
# Check if running
curl http://localhost:3001/health

# Check logs
cd verifier-server
npm start
```

### "Not authorized to submit"
```bash
# Add attestor
npx hardhat console --network coston2
> await oracle.addAttestor("YOUR_ADDRESS");
```

### "Market not resolved yet"
- Polymarket market must be closed
- Check: https://gamma-api.polymarket.com/markets/[conditionId]

## 📚 Architecture Diagram

```
┌──────────────┐
│ User clicks  │
│ "Resolve"    │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Frontend (Next.js)                  │
│  • Checks oracle resolutions         │
│  • Calls API if needed               │
│  • Triggers parlay resolution        │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  API Routes                          │
│  • /api/fdc/request-attestation      │
│  • /api/fdc/submit-to-oracle         │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Verifier Server (Node.js)           │
│  • Fetches Polymarket API            │
│  • Validates market data             │
│  • Returns attestation response      │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  FDC Client (Go)                     │
│  • Monitors attestation requests     │
│  • Queries verifier server           │
│  • Participates in consensus         │
│  • Publishes Merkle roots            │
└──────┬───────────────────────────────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Flare Network                       │
│  • FDC Verification Contract         │
│  • FlarePolymarketOracle             │
│  • ParlayMarket Contract             │
└──────────────────────────────────────┘
```

## 🎓 Learn More

- **Detailed Setup:** See [FDC_ATTESTOR_SETUP.md](./FDC_ATTESTOR_SETUP.md)
- **FDC Integration:** See [FDC_INTEGRATION.md](./FDC_INTEGRATION.md)
- **Flare FDC Docs:** https://dev.flare.network/fdc/overview
- **FDC Client Repo:** https://github.com/flare-foundation/fdc-client

## 💡 Tips

1. **Start with testing mode** to understand the flow
2. **Use resolved markets** for faster testing
3. **Monitor logs** from all components
4. **Set up alerts** for production
5. **Run multiple attestors** for redundancy

## ❓ Need Help?

- Check logs for specific error messages
- Review [FDC_ATTESTOR_SETUP.md](./FDC_ATTESTOR_SETUP.md) for detailed troubleshooting
- Open an issue on GitHub
- Join Flare Discord for community support

---

**Ready to go?** Start with testing mode, then graduate to full FDC when you're comfortable!
