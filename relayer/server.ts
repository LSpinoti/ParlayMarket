import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { Queue } from './queue';
import { verifySignature, createEIP712TypedData } from './eip712';

// =============================================================
//                        CONFIGURATION
// =============================================================

const PORT = process.env.PORT || 3001;
const FLARE_RPC = process.env.FLARE_RPC || 'https://coston2-api.flare.network/ext/C/rpc';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || '';
const EVVM_HUB_ADDRESS = process.env.EVVM_HUB_ADDRESS || '';
const MAX_BATCH_SIZE = 10;
const BATCH_INTERVAL_MS = 1000; // Batch intents every 1 second

// =============================================================
//                          TYPES
// =============================================================

interface BetIntent {
  bettor: string;
  ftsoSymbols: string[];
  targetPrices: string[];
  overUnder: boolean[];
  amount: string;
  expiry: number;
  nonce: number;
  deadline: number;
  signature: string;
}

interface CommitIntent {
  bettor: string;
  commitmentId: string;
  commitment: string;
  amount: string;
  signature: string;
}

interface RevealIntent {
  commitmentId: string;
  bettor: string;
  ftsoSymbols: string[];
  targetPrices: string[];
  overUnder: boolean[];
  expiry: number;
  salt: string;
}

interface WithdrawalIntent {
  user: string;
  amount: string;
  nonce: number;
  signature: string;
}

// =============================================================
//                        INITIALIZATION
// =============================================================

const app = express();
app.use(cors());
app.use(express.json());

// Provider and wallet setup
const provider = new ethers.JsonRpcProvider(FLARE_RPC);
let wallet: ethers.Wallet | null = null;

if (RELAYER_PRIVATE_KEY) {
  wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  console.log(`Relayer wallet: ${wallet.address}`);
}

// Intent queues for batching
const betQueue = new Queue<BetIntent>();
const withdrawalQueue = new Queue<WithdrawalIntent>();

// EVVM Hub ABI (partial)
const EVVM_HUB_ABI = [
  'function placeBetWithIntent(address bettor, bytes32[] ftsoSymbols, uint256[] targetPrices, bool[] overUnder, uint256 amount, uint256 expiry, uint256 nonce, uint256 deadline, bytes signature) external',
  'function batchPlaceBets(address[] bettors, bytes32[][] ftsoSymbolsArray, uint256[][] targetPricesArray, bool[][] overUnderArray, uint256[] amounts, uint256[] expiries, uint256[] nonces, uint256[] deadlines, bytes[] signatures) external',
  'function withdrawWithIntent(address user, uint256 amount, uint256 nonce, bytes signature) external',
  'function commitBet(bytes32 commitmentId, bytes32 commitment, uint256 amount) external',
  'function revealBet(bytes32 commitmentId, address bettor, bytes32[] ftsoSymbols, uint256[] targetPrices, bool[] overUnder, uint256 expiry, bytes32 salt) external',
  'function getVirtualBalance(address user) external view returns (uint256 total, uint256 available, uint256 locked)',
  'function isNonceUsed(address user, uint256 nonce) external view returns (bool)',
  'function DOMAIN_SEPARATOR() external view returns (bytes32)',
];

let evvmHub: ethers.Contract | null = null;

if (EVVM_HUB_ADDRESS && wallet) {
  evvmHub = new ethers.Contract(EVVM_HUB_ADDRESS, EVVM_HUB_ABI, wallet);
}

// =============================================================
//                        API ENDPOINTS
// =============================================================

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    relayer: wallet?.address || 'not configured',
    evvmHub: EVVM_HUB_ADDRESS || 'not configured',
    queuedBets: betQueue.size(),
    queuedWithdrawals: withdrawalQueue.size(),
  });
});

/**
 * Submit a bet intent
 */
app.post('/intent/bet', async (req: Request, res: Response) => {
  try {
    const intent: BetIntent = req.body;

    // Validate intent structure
    if (!intent.bettor || !intent.signature || !intent.ftsoSymbols?.length) {
      return res.status(400).json({ error: 'Invalid intent structure' });
    }

    // Verify deadline
    if (intent.deadline < Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ error: 'Intent expired' });
    }

    // Verify signature (simplified - full implementation in production)
    const isValid = await verifyBetSignature(intent);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Check virtual balance
    if (evvmHub) {
      const [, available] = await evvmHub.getVirtualBalance(intent.bettor);
      if (BigInt(intent.amount) > available) {
        return res.status(400).json({ error: 'Insufficient virtual balance' });
      }

      // Check nonce
      const used = await evvmHub.isNonceUsed(intent.bettor, intent.nonce);
      if (used) {
        return res.status(400).json({ error: 'Nonce already used' });
      }
    }

    // Add to queue
    betQueue.enqueue(intent);

    res.json({
      status: 'queued',
      position: betQueue.size(),
      intentId: `bet-${intent.bettor}-${intent.nonce}`,
    });
  } catch (error) {
    console.error('Error processing bet intent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Submit a Dark Pool commit
 */
app.post('/intent/commit', async (req: Request, res: Response) => {
  try {
    const intent: CommitIntent = req.body;

    if (!intent.bettor || !intent.commitmentId || !intent.commitment) {
      return res.status(400).json({ error: 'Invalid commit structure' });
    }

    // Execute commit immediately (no batching for commits)
    if (!evvmHub || !wallet) {
      return res.status(500).json({ error: 'Relayer not configured' });
    }

    // Note: In production, the user would call commitBet directly
    // or sign an intent for the relayer to submit
    const tx = await evvmHub.commitBet(
      intent.commitmentId,
      intent.commitment,
      intent.amount
    );
    await tx.wait();

    res.json({
      status: 'committed',
      txHash: tx.hash,
      commitmentId: intent.commitmentId,
    });
  } catch (error) {
    console.error('Error processing commit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Submit a Dark Pool reveal
 */
app.post('/intent/reveal', async (req: Request, res: Response) => {
  try {
    const intent: RevealIntent = req.body;

    if (!intent.commitmentId || !intent.bettor || !intent.ftsoSymbols?.length) {
      return res.status(400).json({ error: 'Invalid reveal structure' });
    }

    if (!evvmHub || !wallet) {
      return res.status(500).json({ error: 'Relayer not configured' });
    }

    // Convert symbols to bytes32
    const symbols = intent.ftsoSymbols.map((s) =>
      ethers.encodeBytes32String(s)
    );

    const tx = await evvmHub.revealBet(
      intent.commitmentId,
      intent.bettor,
      symbols,
      intent.targetPrices,
      intent.overUnder,
      intent.expiry,
      intent.salt
    );
    await tx.wait();

    res.json({
      status: 'revealed',
      txHash: tx.hash,
    });
  } catch (error) {
    console.error('Error processing reveal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Submit a withdrawal intent
 */
app.post('/intent/withdraw', async (req: Request, res: Response) => {
  try {
    const intent: WithdrawalIntent = req.body;

    if (!intent.user || !intent.signature || !intent.amount) {
      return res.status(400).json({ error: 'Invalid withdrawal structure' });
    }

    // Add to queue
    withdrawalQueue.enqueue(intent);

    res.json({
      status: 'queued',
      position: withdrawalQueue.size(),
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get EIP-712 typed data for signing
 */
app.post('/typed-data/bet', async (req: Request, res: Response) => {
  try {
    const { bettor, amount, nonce, deadline, betDataHash } = req.body;

    if (!EVVM_HUB_ADDRESS) {
      return res.status(500).json({ error: 'EVVM Hub not configured' });
    }

    const chainId = (await provider.getNetwork()).chainId;

    const typedData = createEIP712TypedData(
      'FlareBet Pro',
      '1',
      Number(chainId),
      EVVM_HUB_ADDRESS,
      {
        BetIntent: [
          { name: 'bettor', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'encryptedData', type: 'bytes32' },
        ],
      },
      'BetIntent',
      { bettor, amount, nonce, deadline, encryptedData: betDataHash }
    );

    res.json(typedData);
  } catch (error) {
    console.error('Error creating typed data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get virtual balance
 */
app.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    if (!evvmHub) {
      return res.status(500).json({ error: 'EVVM Hub not configured' });
    }

    const [total, available, locked] = await evvmHub.getVirtualBalance(
      req.params.address
    );

    res.json({
      total: total.toString(),
      available: available.toString(),
      locked: locked.toString(),
    });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get next available nonce for a user
 */
app.get('/nonce/:address', async (req: Request, res: Response) => {
  try {
    if (!evvmHub) {
      return res.status(500).json({ error: 'EVVM Hub not configured' });
    }

    // Find next unused nonce (simple approach - check sequentially)
    let nonce = 0;
    while (await evvmHub.isNonceUsed(req.params.address, nonce)) {
      nonce++;
      if (nonce > 10000) {
        return res.status(500).json({ error: 'Could not find available nonce' });
      }
    }

    res.json({ nonce });
  } catch (error) {
    console.error('Error getting nonce:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================
//                     BATCH PROCESSING
// =============================================================

/**
 * Process bet queue in batches
 */
async function processBetQueue() {
  if (betQueue.isEmpty() || !evvmHub || !wallet) return;

  const batch: BetIntent[] = [];
  while (!betQueue.isEmpty() && batch.length < MAX_BATCH_SIZE) {
    const intent = betQueue.dequeue();
    if (intent) batch.push(intent);
  }

  if (batch.length === 0) return;

  console.log(`Processing batch of ${batch.length} bets`);

  try {
    if (batch.length === 1) {
      // Single bet
      const intent = batch[0];
      const symbols = intent.ftsoSymbols.map((s) =>
        ethers.encodeBytes32String(s)
      );

      const tx = await evvmHub.placeBetWithIntent(
        intent.bettor,
        symbols,
        intent.targetPrices,
        intent.overUnder,
        intent.amount,
        intent.expiry,
        intent.nonce,
        intent.deadline,
        intent.signature
      );
      await tx.wait();
      console.log(`Single bet processed: ${tx.hash}`);
    } else {
      // Batch bets
      const bettors = batch.map((i) => i.bettor);
      const ftsoSymbolsArray = batch.map((i) =>
        i.ftsoSymbols.map((s) => ethers.encodeBytes32String(s))
      );
      const targetPricesArray = batch.map((i) => i.targetPrices);
      const overUnderArray = batch.map((i) => i.overUnder);
      const amounts = batch.map((i) => i.amount);
      const expiries = batch.map((i) => i.expiry);
      const nonces = batch.map((i) => i.nonce);
      const deadlines = batch.map((i) => i.deadline);
      const signatures = batch.map((i) => i.signature);

      const tx = await evvmHub.batchPlaceBets(
        bettors,
        ftsoSymbolsArray,
        targetPricesArray,
        overUnderArray,
        amounts,
        expiries,
        nonces,
        deadlines,
        signatures
      );
      await tx.wait();
      console.log(`Batch of ${batch.length} bets processed: ${tx.hash}`);
    }
  } catch (error) {
    console.error('Error processing bet batch:', error);
    // Re-queue failed intents
    batch.forEach((intent) => betQueue.enqueue(intent));
  }
}

/**
 * Process withdrawal queue
 */
async function processWithdrawalQueue() {
  if (withdrawalQueue.isEmpty() || !evvmHub || !wallet) return;

  const intent = withdrawalQueue.dequeue();
  if (!intent) return;

  try {
    const tx = await evvmHub.withdrawWithIntent(
      intent.user,
      intent.amount,
      intent.nonce,
      intent.signature
    );
    await tx.wait();
    console.log(`Withdrawal processed: ${tx.hash}`);
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    // Re-queue on failure
    withdrawalQueue.enqueue(intent);
  }
}

// =============================================================
//                       HELPERS
// =============================================================

async function verifyBetSignature(intent: BetIntent): Promise<boolean> {
  try {
    // Create bet data hash
    const betDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32[]', 'uint256[]', 'bool[]', 'uint256'],
        [
          intent.ftsoSymbols.map((s) => ethers.encodeBytes32String(s)),
          intent.targetPrices,
          intent.overUnder,
          intent.expiry,
        ]
      )
    );

    // Recreate the EIP-712 digest
    // This is simplified - full implementation would use domain separator from contract
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'uint256', 'uint256', 'uint256', 'bytes32'],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes(
              'BetIntent(address bettor,uint256 amount,uint256 nonce,uint256 deadline,bytes32 encryptedData)'
            )
          ),
          intent.bettor,
          intent.amount,
          intent.nonce,
          intent.deadline,
          betDataHash,
        ]
      )
    );

    // Recover signer
    const recovered = ethers.recoverAddress(structHash, intent.signature);
    return recovered.toLowerCase() === intent.bettor.toLowerCase();
  } catch {
    return false;
  }
}

// =============================================================
//                         START
// =============================================================

// Start batch processing intervals
setInterval(processBetQueue, BATCH_INTERVAL_MS);
setInterval(processWithdrawalQueue, BATCH_INTERVAL_MS * 2);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Relayer server running on port ${PORT}`);
  console.log(`RPC: ${FLARE_RPC}`);
  console.log(`EVVM Hub: ${EVVM_HUB_ADDRESS || 'not configured'}`);
});

export default app;
