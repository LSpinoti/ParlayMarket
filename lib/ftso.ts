import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ChainName } from './contracts';

// =============================================================
//                      FTSO REGISTRY ABI
// =============================================================

export const FTSO_REGISTRY_ABI = [
  'function getCurrentPriceWithDecimals(string _symbol) external view returns (uint256 _price, uint256 _timestamp, uint256 _decimals)',
  'function getCurrentPriceWithDecimalsByIndex(uint256 _assetIndex) external view returns (uint256 _price, uint256 _timestamp, uint256 _decimals)',
  'function getSupportedSymbols() external view returns (string[])',
  'function getSupportedSymbolByIndex(uint256 _index) external view returns (string)',
  'function getSupportedIndicesAndSymbols() external view returns (uint256[] _indices, string[] _symbols)',
  'function getFtsoBySymbol(string _symbol) external view returns (address)',
];

// =============================================================
//                          TYPES
// =============================================================

export interface FTSOPrice {
  symbol: string;
  price: string;       // Formatted price
  priceRaw: bigint;    // Raw price
  timestamp: number;
  decimals: number;
}

export interface FTSOSymbol {
  index: number;
  symbol: string;
}

// =============================================================
//                      FTSO CLIENT
// =============================================================

export class FTSOClient {
  private contract: ethers.Contract;
  private chain: ChainName;

  constructor(provider: ethers.Provider, chain: ChainName = 'coston2') {
    this.chain = chain;
    const registryAddress = CONTRACT_ADDRESSES[chain].FtsoRegistry;
    this.contract = new ethers.Contract(registryAddress, FTSO_REGISTRY_ABI, provider);
  }

  /**
   * Get current price for a symbol
   */
  async getCurrentPrice(symbol: string): Promise<FTSOPrice> {
    const [price, timestamp, decimals] = await this.contract.getCurrentPriceWithDecimals(symbol);

    return {
      symbol,
      price: this.formatPrice(price, Number(decimals)),
      priceRaw: price,
      timestamp: Number(timestamp),
      decimals: Number(decimals),
    };
  }

  /**
   * Get prices for multiple symbols
   */
  async getMultiplePrices(symbols: string[]): Promise<FTSOPrice[]> {
    const prices = await Promise.all(
      symbols.map((symbol) => this.getCurrentPrice(symbol))
    );
    return prices;
  }

  /**
   * Get all supported symbols
   */
  async getSupportedSymbols(): Promise<string[]> {
    return this.contract.getSupportedSymbols();
  }

  /**
   * Get supported symbols with indices
   */
  async getSupportedIndicesAndSymbols(): Promise<FTSOSymbol[]> {
    const [indices, symbols] = await this.contract.getSupportedIndicesAndSymbols();

    return indices.map((index: bigint, i: number) => ({
      index: Number(index),
      symbol: symbols[i],
    }));
  }

  /**
   * Format raw price with decimals
   */
  private formatPrice(price: bigint, decimals: number): string {
    const divisor = BigInt(10 ** decimals);
    const integerPart = price / divisor;
    const fractionalPart = price % divisor;

    // Pad fractional part with leading zeros
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');

    return `${integerPart}.${fractionalStr}`;
  }
}

// =============================================================
//                    PRICE UTILITIES
// =============================================================

/**
 * Convert FTSO price to wei for smart contract
 */
export function priceToWei(price: string, decimals: number = 5): string {
  const parts = price.split('.');
  const integerPart = parts[0];
  const fractionalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);

  return integerPart + fractionalPart;
}

/**
 * Convert wei to readable price
 */
export function weiToPrice(wei: string | bigint, decimals: number = 5): string {
  const weiStr = wei.toString().padStart(decimals + 1, '0');
  const insertPosition = weiStr.length - decimals;

  return `${weiStr.slice(0, insertPosition)}.${weiStr.slice(insertPosition)}`;
}

/**
 * Calculate percentage change between two prices
 */
export function calculatePriceChange(
  currentPrice: bigint,
  targetPrice: bigint
): { percentage: number; isUp: boolean } {
  if (currentPrice === BigInt(0)) {
    return { percentage: 0, isUp: false };
  }

  const diff = targetPrice - currentPrice;
  const percentage = Number((diff * BigInt(10000)) / currentPrice) / 100;

  return {
    percentage: Math.abs(percentage),
    isUp: diff > BigInt(0),
  };
}

// =============================================================
//                    POPULAR SYMBOLS
// =============================================================

/**
 * Common FTSO symbols available on Flare
 */
export const POPULAR_SYMBOLS = [
  { symbol: 'FLR', name: 'Flare' },
  { symbol: 'SGB', name: 'Songbird' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'XLM', name: 'Stellar' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'ALGO', name: 'Algorand' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'ARB', name: 'Arbitrum' },
  { symbol: 'FIL', name: 'Filecoin' },
  { symbol: 'ATOM', name: 'Cosmos' },
  { symbol: 'NEAR', name: 'Near' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'UNI', name: 'Uniswap' },
];

/**
 * Get symbol display name
 */
export function getSymbolName(symbol: string): string {
  const found = POPULAR_SYMBOLS.find((s) => s.symbol === symbol);
  return found?.name || symbol;
}

// =============================================================
//                    HOOK-FRIENDLY EXPORTS
// =============================================================

/**
 * Create FTSO client from browser provider
 */
export async function createFTSOClient(
  provider: ethers.BrowserProvider,
  chain: ChainName = 'coston2'
): Promise<FTSOClient> {
  return new FTSOClient(provider, chain);
}
