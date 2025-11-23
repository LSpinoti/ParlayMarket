import { ethers } from 'ethers';

// =============================================================
//                    DARK POOL ENCRYPTION
// =============================================================

/**
 * Bet data structure for Dark Pool commits
 */
export interface DarkPoolBetData {
  bettor: string;
  ftsoSymbols: string[];
  targetPrices: string[];
  overUnder: boolean[];
  expiry: number;
}

/**
 * Commitment data for Dark Pool
 */
export interface CommitmentData {
  commitmentId: string;
  commitment: string;
  salt: string;
  betData: DarkPoolBetData;
}

// =============================================================
//                    COMMITMENT CREATION
// =============================================================

/**
 * Generate a random salt for commitment
 */
export function generateSalt(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return ethers.hexlify(randomBytes);
}

/**
 * Generate commitment ID
 */
export function generateCommitmentId(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return ethers.hexlify(randomBytes);
}

/**
 * Create commitment hash for Dark Pool bet
 */
export function createCommitment(
  betData: DarkPoolBetData,
  salt: string
): string {
  // Convert symbols to bytes32
  const ftsoSymbolsBytes = betData.ftsoSymbols.map((s) =>
    ethers.encodeBytes32String(s)
  );

  // Hash the bet data with salt
  const commitment = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'bytes32[]', 'uint256[]', 'bool[]', 'uint256', 'bytes32'],
      [
        betData.bettor,
        ftsoSymbolsBytes,
        betData.targetPrices,
        betData.overUnder,
        betData.expiry,
        salt,
      ]
    )
  );

  return commitment;
}

/**
 * Create full commitment data for a Dark Pool bet
 */
export function createDarkPoolCommitment(
  betData: DarkPoolBetData
): CommitmentData {
  const salt = generateSalt();
  const commitmentId = generateCommitmentId();
  const commitment = createCommitment(betData, salt);

  return {
    commitmentId,
    commitment,
    salt,
    betData,
  };
}

// =============================================================
//                    LOCAL ENCRYPTION
// =============================================================

/**
 * Encrypt bet data using AES-GCM for local storage
 * Uses Web Crypto API
 */
export async function encryptBetData(
  betData: DarkPoolBetData,
  password: string
): Promise<string> {
  // Derive key from password
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Encrypt data
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(betData));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(
    salt.length + iv.length + ciphertext.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return ethers.hexlify(combined);
}

/**
 * Decrypt bet data
 */
export async function decryptBetData(
  encryptedHex: string,
  password: string
): Promise<DarkPoolBetData> {
  const encrypted = ethers.getBytes(encryptedHex);

  // Extract salt, iv, ciphertext
  const salt = encrypted.slice(0, 16);
  const iv = encrypted.slice(16, 28);
  const ciphertext = encrypted.slice(28);

  // Derive key
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext));
}

// =============================================================
//                    STORAGE HELPERS
// =============================================================

const STORAGE_KEY_PREFIX = 'flarebet_commitment_';

/**
 * Store commitment data in localStorage (encrypted)
 */
export async function storeCommitment(
  commitmentId: string,
  data: CommitmentData,
  password: string
): Promise<void> {
  const encrypted = await encryptBetData(
    { ...data.betData, salt: data.salt } as DarkPoolBetData & { salt: string },
    password
  );

  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${commitmentId}`,
    JSON.stringify({
      encrypted,
      commitment: data.commitment,
      timestamp: Date.now(),
    })
  );
}

/**
 * Retrieve commitment data from localStorage
 */
export async function retrieveCommitment(
  commitmentId: string,
  password: string
): Promise<CommitmentData | null> {
  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${commitmentId}`);
  if (!stored) return null;

  const { encrypted, commitment } = JSON.parse(stored);
  const decrypted = (await decryptBetData(encrypted, password)) as DarkPoolBetData & {
    salt: string;
  };

  return {
    commitmentId,
    commitment,
    salt: decrypted.salt,
    betData: {
      bettor: decrypted.bettor,
      ftsoSymbols: decrypted.ftsoSymbols,
      targetPrices: decrypted.targetPrices,
      overUnder: decrypted.overUnder,
      expiry: decrypted.expiry,
    },
  };
}

/**
 * List all stored commitments
 */
export function listStoredCommitments(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      keys.push(key.replace(STORAGE_KEY_PREFIX, ''));
    }
  }
  return keys;
}

/**
 * Remove stored commitment
 */
export function removeStoredCommitment(commitmentId: string): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${commitmentId}`);
}

// =============================================================
//                    DARK POOL CLIENT
// =============================================================

export class DarkPoolClient {
  private relayerUrl: string;

  constructor(relayerUrl: string) {
    this.relayerUrl = relayerUrl;
  }

  /**
   * Submit a Dark Pool commit
   */
  async submitCommit(
    commitmentId: string,
    commitment: string,
    amount: string,
    signature: string
  ): Promise<{ status: string; txHash?: string; error?: string }> {
    const response = await fetch(`${this.relayerUrl}/intent/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitmentId,
        commitment,
        amount,
        signature,
      }),
    });

    return response.json();
  }

  /**
   * Submit a Dark Pool reveal
   */
  async submitReveal(
    commitmentData: CommitmentData
  ): Promise<{ status: string; txHash?: string; error?: string }> {
    const response = await fetch(`${this.relayerUrl}/intent/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitmentId: commitmentData.commitmentId,
        bettor: commitmentData.betData.bettor,
        ftsoSymbols: commitmentData.betData.ftsoSymbols,
        targetPrices: commitmentData.betData.targetPrices,
        overUnder: commitmentData.betData.overUnder,
        expiry: commitmentData.betData.expiry,
        salt: commitmentData.salt,
      }),
    });

    return response.json();
  }
}
