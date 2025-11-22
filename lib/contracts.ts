import abis from '../contracts/abis.json';

// Contract addresses - Update these after deployment
export const CONTRACT_ADDRESSES = {
  // Flare Testnet (Coston2)
  coston2: {
    ParlayMarket: '0x8C8fA8956487cb81C1Ac5AADbDe4D17fbD5dC66b',
    ParlayToken: '0xb849b96137BA8a23ac16E6Fe78DeAE936A444762',
    FlarePolymarketOracle: '0x8ba98E5975bcfEa2EB9541FD2B705e50386d3176',
    FdcVerification: '0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91', // Flare FDC Verification contract
  },
  // Flare Mainnet
  flare: {
    ParlayMarket: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment
    ParlayToken: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment
    FlarePolymarketOracle: '0x0000000000000000000000000000000000000000', // TODO: Update after deployment
    FdcVerification: '0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91', // Flare FDC Verification contract
  },
};

export const CHAIN_CONFIG = {
  coston2: {
    chainId: 114,
    name: 'Coston2',
    rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
    blockExplorer: 'https://coston2-explorer.flare.network',
    nativeCurrency: {
      name: 'Coston2 Flare',
      symbol: 'C2FLR',
      decimals: 18,
    },
  },
  flare: {
    chainId: 14,
    name: 'Flare',
    rpcUrl: 'https://flare-api.flare.network/ext/C/rpc',
    blockExplorer: 'https://flare-explorer.flare.network',
    nativeCurrency: {
      name: 'Flare',
      symbol: 'FLR',
      decimals: 18,
    },
  },
};

export const ABIS = abis;

export type ChainName = keyof typeof CONTRACT_ADDRESSES;
export type ParlayStatus = 'Created' | 'Filled' | 'Resolved' | 'Cancelled' | 'Invalid';

export interface ParlayData {
  id: number;
  maker: string;
  taker: string;
  name: string;
  conditionIds: string[];
  requiredOutcomes: number[];
  legNames: string[];
  imageUrls: string[];
  makerStake: bigint;
  takerStake: bigint;
  expiry: number;
  status: number;
  makerIsYes: boolean;
  yesTokenId?: string | null;
  noTokenId?: string | null;
}

export function getParlayStatusString(status: number): ParlayStatus {
  const statuses: ParlayStatus[] = ['Created', 'Filled', 'Resolved', 'Cancelled', 'Invalid'];
  return statuses[status] || 'Created';
}

export function getOutcomeString(outcome: number): string {
  const outcomes = ['NO', 'YES', 'INVALID'];
  return outcomes[outcome] || 'UNKNOWN';
}

