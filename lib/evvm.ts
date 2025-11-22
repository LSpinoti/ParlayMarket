import { ethers } from 'ethers';

// =============================================================
//                        CONFIGURATION
// =============================================================

export const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3001';

export const EVVM_HUB_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 amount) external',
  'function getVirtualBalance(address user) external view returns (uint256 total, uint256 available, uint256 locked)',
  'function getBet(uint256 betId) external view returns (tuple(uint256 id, address bettor, bytes32[] ftsoSymbols, uint256[] targetPrices, bool[] overUnder, uint256 stake, uint256 potentialPayout, uint256 expiry, bool settled, bool won))',
  'function getUserBets(address user) external view returns (uint256[])',
  'function getTotalBets() external view returns (uint256)',
  'function isNonceUsed(address user, uint256 nonce) external view returns (bool)',
  'function DOMAIN_SEPARATOR() external view returns (bytes32)',
];

// =============================================================
//                          TYPES
// =============================================================

export interface BetLeg {
  symbol: string;      // FTSO symbol (e.g., "FLR", "BTC")
  targetPrice: string; // Target price in wei
  isOver: boolean;     // true = over, false = under
}

export interface BetIntent {
  bettor: string;
  legs: BetLeg[];
  amount: string;      // In wei
  expiry: number;      // Unix timestamp
  nonce: number;
  deadline: number;    // Signature expiry
}

export interface VirtualBalance {
  total: string;
  available: string;
  locked: string;
}

export interface VirtualBet {
  id: number;
  bettor: string;
  ftsoSymbols: string[];
  targetPrices: string[];
  overUnder: boolean[];
  stake: string;
  potentialPayout: string;
  expiry: number;
  settled: boolean;
  won: boolean;
}

// =============================================================
//                    EIP-712 TYPED DATA
// =============================================================

export function createBetTypedData(
  chainId: number,
  verifyingContract: string,
  bettor: string,
  amount: string,
  nonce: number,
  deadline: number,
  betDataHash: string
) {
  return {
    types: {
      BetIntent: [
        { name: 'bettor', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'encryptedData', type: 'bytes32' },
      ],
    },
    primaryType: 'BetIntent',
    domain: {
      name: 'FlareBet Pro',
      version: '1',
      chainId,
      verifyingContract,
    },
    message: {
      bettor,
      amount,
      nonce,
      deadline,
      encryptedData: betDataHash,
    },
  };
}

export function createWithdrawalTypedData(
  chainId: number,
  verifyingContract: string,
  user: string,
  amount: string,
  nonce: number
) {
  return {
    types: {
      Withdrawal: [
        { name: 'user', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'Withdrawal',
    domain: {
      name: 'FlareBet Pro',
      version: '1',
      chainId,
      verifyingContract,
    },
    message: {
      user,
      amount,
      nonce,
    },
  };
}

// =============================================================
//                      EVVM CLIENT
// =============================================================

export class EVVMClient {
  private provider: ethers.BrowserProvider;
  private chainId: number;
  private evvmHubAddress: string;

  constructor(
    provider: ethers.BrowserProvider,
    chainId: number,
    evvmHubAddress: string
  ) {
    this.provider = provider;
    this.chainId = chainId;
    this.evvmHubAddress = evvmHubAddress;
  }

  /**
   * Sign a bet intent using EIP-712
   */
  async signBetIntent(intent: BetIntent): Promise<string> {
    const signer = await this.provider.getSigner();

    // Create bet data hash
    const ftsoSymbols = intent.legs.map((leg) =>
      ethers.encodeBytes32String(leg.symbol)
    );
    const targetPrices = intent.legs.map((leg) => leg.targetPrice);
    const overUnder = intent.legs.map((leg) => leg.isOver);

    const betDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32[]', 'uint256[]', 'bool[]', 'uint256'],
        [ftsoSymbols, targetPrices, overUnder, intent.expiry]
      )
    );

    // Create typed data
    const typedData = createBetTypedData(
      this.chainId,
      this.evvmHubAddress,
      intent.bettor,
      intent.amount,
      intent.nonce,
      intent.deadline,
      betDataHash
    );

    // Sign using eth_signTypedData_v4
    const signature = await signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    return signature;
  }

  /**
   * Sign a withdrawal intent
   */
  async signWithdrawalIntent(
    user: string,
    amount: string,
    nonce: number
  ): Promise<string> {
    const signer = await this.provider.getSigner();

    const typedData = createWithdrawalTypedData(
      this.chainId,
      this.evvmHubAddress,
      user,
      amount,
      nonce
    );

    const signature = await signer.signTypedData(
      typedData.domain,
      typedData.types,
      typedData.message
    );

    return signature;
  }

  /**
   * Submit bet intent to relayer
   */
  async submitBetIntent(intent: BetIntent, signature: string): Promise<{
    status: string;
    intentId?: string;
    error?: string;
  }> {
    const ftsoSymbols = intent.legs.map((leg) => leg.symbol);
    const targetPrices = intent.legs.map((leg) => leg.targetPrice);
    const overUnder = intent.legs.map((leg) => leg.isOver);

    const response = await fetch(`${RELAYER_URL}/intent/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bettor: intent.bettor,
        ftsoSymbols,
        targetPrices,
        overUnder,
        amount: intent.amount,
        expiry: intent.expiry,
        nonce: intent.nonce,
        deadline: intent.deadline,
        signature,
      }),
    });

    return response.json();
  }

  /**
   * Submit withdrawal intent to relayer
   */
  async submitWithdrawalIntent(
    user: string,
    amount: string,
    nonce: number,
    signature: string
  ): Promise<{ status: string; error?: string }> {
    const response = await fetch(`${RELAYER_URL}/intent/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user,
        amount,
        nonce,
        signature,
      }),
    });

    return response.json();
  }

  /**
   * Get next available nonce
   */
  async getNextNonce(address: string): Promise<number> {
    const response = await fetch(`${RELAYER_URL}/nonce/${address}`);
    const data = await response.json();
    return data.nonce;
  }

  /**
   * Get virtual balance from relayer
   */
  async getVirtualBalance(address: string): Promise<VirtualBalance> {
    const response = await fetch(`${RELAYER_URL}/balance/${address}`);
    return response.json();
  }

  /**
   * Get relayer health status
   */
  async getRelayerStatus(): Promise<{
    status: string;
    relayer: string;
    evvmHub: string;
    queuedBets: number;
  }> {
    const response = await fetch(`${RELAYER_URL}/health`);
    return response.json();
  }
}

// =============================================================
//                    CONTRACT INTERACTIONS
// =============================================================

/**
 * Get EVVM Hub contract instance
 */
export function getEVVMHubContract(
  address: string,
  signerOrProvider: ethers.Signer | ethers.Provider
): ethers.Contract {
  return new ethers.Contract(address, EVVM_HUB_ABI, signerOrProvider);
}

/**
 * Deposit FLR to virtual balance (direct contract call)
 */
export async function depositToVirtual(
  contract: ethers.Contract,
  amount: string
): Promise<ethers.TransactionResponse> {
  return contract.deposit({ value: ethers.parseEther(amount) });
}

/**
 * Withdraw from virtual balance (direct contract call)
 */
export async function withdrawFromVirtual(
  contract: ethers.Contract,
  amount: string
): Promise<ethers.TransactionResponse> {
  return contract.withdraw(ethers.parseEther(amount));
}

/**
 * Get virtual balance from contract
 */
export async function getVirtualBalanceFromContract(
  contract: ethers.Contract,
  address: string
): Promise<VirtualBalance> {
  const [total, available, locked] = await contract.getVirtualBalance(address);
  return {
    total: total.toString(),
    available: available.toString(),
    locked: locked.toString(),
  };
}

/**
 * Get user's bets from contract
 */
export async function getUserBetsFromContract(
  contract: ethers.Contract,
  address: string
): Promise<number[]> {
  const betIds = await contract.getUserBets(address);
  return betIds.map((id: bigint) => Number(id));
}

/**
 * Get bet details from contract
 */
export async function getBetFromContract(
  contract: ethers.Contract,
  betId: number
): Promise<VirtualBet> {
  const bet = await contract.getBet(betId);
  return {
    id: Number(bet.id),
    bettor: bet.bettor,
    ftsoSymbols: bet.ftsoSymbols.map((s: string) =>
      ethers.decodeBytes32String(s)
    ),
    targetPrices: bet.targetPrices.map((p: bigint) => p.toString()),
    overUnder: bet.overUnder,
    stake: bet.stake.toString(),
    potentialPayout: bet.potentialPayout.toString(),
    expiry: Number(bet.expiry),
    settled: bet.settled,
    won: bet.won,
  };
}

// =============================================================
//                        UTILITIES
// =============================================================

/**
 * Format virtual balance for display
 */
export function formatVirtualBalance(balance: VirtualBalance): {
  total: string;
  available: string;
  locked: string;
} {
  return {
    total: ethers.formatEther(balance.total),
    available: ethers.formatEther(balance.available),
    locked: ethers.formatEther(balance.locked),
  };
}

/**
 * Calculate potential payout (simplified)
 */
export function calculatePotentialPayout(
  stake: string,
  legs: number
): string {
  const multiplier = Math.pow(2, legs);
  const stakeInEther = parseFloat(ethers.formatEther(stake));
  return (stakeInEther * multiplier).toFixed(4);
}

/**
 * Create deadline timestamp (seconds from now)
 */
export function createDeadline(secondsFromNow: number = 300): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

/**
 * Check if intent deadline has passed
 */
export function isDeadlinePassed(deadline: number): boolean {
  return Math.floor(Date.now() / 1000) > deadline;
}
