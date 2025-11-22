/**
 * Utility functions for ParlayMarket
 */

/**
 * Format a wallet address to show only first and last characters
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a date timestamp to readable string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const time = timestamp * 1000;
  const diff = time - now;
  const absDiff = Math.abs(diff);
  
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const isPast = diff < 0;
  const prefix = isPast ? '' : 'in ';
  const suffix = isPast ? ' ago' : '';
  
  if (days > 0) return `${prefix}${days} day${days > 1 ? 's' : ''}${suffix}`;
  if (hours > 0) return `${prefix}${hours} hour${hours > 1 ? 's' : ''}${suffix}`;
  if (minutes > 0) return `${prefix}${minutes} minute${minutes > 1 ? 's' : ''}${suffix}`;
  return `${prefix}${seconds} second${seconds > 1 ? 's' : ''}${suffix}`;
}

/**
 * Check if a timestamp has expired
 */
export function isExpired(timestamp: number): boolean {
  return timestamp * 1000 < Date.now();
}

/**
 * Generate a random bytes32 hex string (for testing)
 */
export function randomBytes32(): string {
  const hex = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 64; i++) {
    result += hex[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Validate a bytes32 hex string
 */
export function isValidBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

/**
 * Calculate potential profit from a parlay
 */
export function calculateProfit(stake: bigint, totalPot: bigint): bigint {
  return totalPot - stake;
}

/**
 * Calculate implied probability from odds
 */
export function calculateImpliedProbability(makerStake: number, takerStake: number, isYes: boolean): number {
  const total = makerStake + takerStake;
  if (total === 0) return 0;
  
  // If maker is YES, they win totalPot if all legs hit
  // Their implied probability is their risk / total pot
  const yesProbability = isYes 
    ? (takerStake / total) * 100
    : (makerStake / total) * 100;
  
  return Math.round(yesProbability * 10) / 10;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Open block explorer for an address or transaction
 */
export function openInExplorer(addressOrTx: string, chain: 'coston2' | 'flare' = 'coston2'): void {
  const baseUrl = chain === 'coston2' 
    ? 'https://coston2-explorer.flare.network'
    : 'https://flare-explorer.flare.network';
  
  const isTransaction = addressOrTx.length > 42;
  const path = isTransaction ? 'tx' : 'address';
  
  window.open(`${baseUrl}/${path}/${addressOrTx}`, '_blank');
}

/**
 * Parse error message from contract revert
 */
export function parseContractError(error: any): string {
  if (typeof error === 'string') return error;
  
  if (error?.reason) return error.reason;
  if (error?.message) {
    // Extract revert reason if present
    const match = error.message.match(/reason="([^"]+)"/);
    if (match) return match[1];
    return error.message;
  }
  
  return 'Transaction failed';
}

