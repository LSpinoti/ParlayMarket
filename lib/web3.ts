'use client';

import { BrowserProvider, Contract, formatEther, parseEther, EventLog } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS, ChainName } from './contracts';

let provider: BrowserProvider | null = null;
let currentAccount: string | null = null;

export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectWallet(): Promise<string> {
  if (!isMetaMaskInstalled()) {
    throw new Error('METAMASK_NOT_INSTALLED');
  }

  provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send('eth_requestAccounts', []);
  currentAccount = accounts[0] || null;
  if (!currentAccount) {
    throw new Error('No accounts found');
  }
  return currentAccount;
}

export async function getProvider(): Promise<BrowserProvider> {
  if (!provider) {
    if (!isMetaMaskInstalled()) {
      throw new Error('METAMASK_NOT_INSTALLED');
    }
    provider = new BrowserProvider(window.ethereum);
  }
  return provider;
}

export async function getCurrentAccount(): Promise<string | null> {
  if (currentAccount) return currentAccount;
  
  try {
    const provider = await getProvider();
    const accounts = await provider.send('eth_accounts', []);
    if (accounts.length > 0) {
      currentAccount = accounts[0];
      return currentAccount;
    }
  } catch (error) {
    console.error('Error getting account:', error);
  }
  
  return null;
}

export async function switchToFlareNetwork(chain: ChainName = 'coston2'): Promise<void> {
  if (!isMetaMaskInstalled()) {
    throw new Error('METAMASK_NOT_INSTALLED');
  }

  const chainId = chain === 'coston2' ? '0x72' : '0xe'; // 114 or 14

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (error: any) {
    // Chain not added, add it
    if (error.code === 4902) {
      const config = chain === 'coston2' 
        ? {
            chainId: '0x72',
            chainName: 'Coston2 Testnet',
            nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
            rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
            blockExplorerUrls: ['https://coston2-explorer.flare.network'],
          }
        : {
            chainId: '0xe',
            chainName: 'Flare Network',
            nativeCurrency: { name: 'FLR', symbol: 'FLR', decimals: 18 },
            rpcUrls: ['https://flare-api.flare.network/ext/C/rpc'],
            blockExplorerUrls: ['https://flare-explorer.flare.network'],
          };

      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [config],
      });
    } else {
      throw error;
    }
  }
}

export async function getParlayMarketContract(chain: ChainName = 'coston2'): Promise<Contract> {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const address = CONTRACT_ADDRESSES[chain].ParlayMarket;
  return new Contract(address, ABIS.ParlayMarket, signer);
}

export async function getParlayTokenContract(chain: ChainName = 'coston2'): Promise<Contract> {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const parlayMarket = await getParlayMarketContract(chain);
  const tokenAddress = await parlayMarket.parlayToken();
  return new Contract(tokenAddress, ABIS.ParlayToken, signer);
}

/**
 * Prompt Metamask to import an NFT
 * @param tokenAddress The NFT contract address
 * @param tokenId The token ID to import
 */
export async function importNFTToMetamask(
  tokenAddress: string,
  tokenId: string
): Promise<boolean> {
  if (!isMetaMaskInstalled()) {
    console.warn('MetaMask not installed');
    return false;
  }

  try {
    const wasAdded = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC721',
        options: {
          address: tokenAddress,
          tokenId: tokenId,
        },
      },
    });
    return wasAdded;
  } catch (error) {
    console.error('Error importing NFT to Metamask:', error);
    return false;
  }
}

/**
 * Get token IDs for a parlay by querying past events
 * Uses chunking strategy to work around RPC block range limits
 * @param parlayId The parlay ID
 * @param chain The chain name
 */
export async function getParlayTokenIds(
  parlayId: number,
  chain: ChainName = 'coston2'
): Promise<{ yesTokenId: string | null; noTokenId: string | null }> {
  const contract = await getParlayMarketContract(chain);
  const provider = await getProvider();
  const currentBlock = await provider.getBlockNumber();
  const filter = contract.filters.ParlayFilled(parlayId);
  
  // Strategy 1: Try querying in small chunks going backwards from current block
  // This works around RPC limits by querying small ranges
  const chunkSize = 20; // Very small chunks to avoid RPC limits
  const maxChunks = 100; // Limit total chunks to avoid too many requests
  
  for (let i = 0; i < maxChunks; i++) {
    try {
      const chunkFrom = currentBlock - (chunkSize * (i + 1));
      const chunkTo = currentBlock - (chunkSize * i);
      
      if (chunkFrom < 0) break;
      
      const events = await contract.queryFilter(filter, chunkFrom, chunkTo);
      
      if (events.length > 0 && events[events.length - 1] instanceof EventLog) {
        const latestEvent = events[events.length - 1] as EventLog;
        const args = latestEvent.args as any;
        
        let yesTokenId: string | null = null;
        let noTokenId: string | null = null;
        
        if (Array.isArray(args)) {
          if (args.length >= 4) {
            yesTokenId = args[2]?.toString() || null;
            noTokenId = args[3]?.toString() || null;
          }
        } else if (args && typeof args === 'object') {
          yesTokenId = args.yesTokenId?.toString() || null;
          noTokenId = args.noTokenId?.toString() || null;
        }
        
        if (yesTokenId && yesTokenId !== '0' && noTokenId && noTokenId !== '0') {
          return {
            yesTokenId: yesTokenId,
            noTokenId: noTokenId,
          };
        }
      }
    } catch (chunkError: any) {
      // If chunk fails, try next chunk
      // Only log if it's not a "too many blocks" error (which we expect)
      const isBlockLimitError = chunkError?.message?.includes('too many blocks') || chunkError?.code === -32603;
      if (!isBlockLimitError) {
        console.warn(`Error querying chunk ${i}:`, chunkError.message);
      }
      continue;
    }
  }
  
  // Strategy 2: Try alternative approach using token contract Transfer events
  // This might have different RPC limits
  try {
    const tokenContract = await getParlayTokenContract(chain);
    
    // Query Transfer events from zero address (minting) in small chunks
    // We'll check if the token belongs to our parlay
    const transferFilter = tokenContract.filters.Transfer(null, null, null);
    
    // Try last 100 blocks first
    for (let chunk = 0; chunk < 10; chunk++) {
      try {
        const chunkFrom = Math.max(0, currentBlock - (100 * (chunk + 1)));
        const chunkTo = currentBlock - (100 * chunk);
        
        if (chunkFrom < 0) break;
        
        const transferEvents = await tokenContract.queryFilter(transferFilter, chunkFrom, chunkTo);
        
        // Check each transfer event to see if it's a mint for our parlay
        for (const event of transferEvents) {
          if (event instanceof EventLog) {
            const args = event.args as any;
            const from = Array.isArray(args) ? args[0] : args.from;
            const tokenId = Array.isArray(args) ? args[2] : args.tokenId;
            
            // Check if this is a mint (from zero address)
            if (from && typeof from === 'string' && from.toLowerCase() === '0x0000000000000000000000000000000000000000') {
              try {
                // Check if this token belongs to our parlay
                const tokenParlayId = await tokenContract.tokenToParlayId(tokenId);
                if (Number(tokenParlayId) === parlayId) {
                  const isYes = await tokenContract.tokenSide(tokenId);
                  if (isYes) {
                    // Find the corresponding NO token
                    const noTokenId = await findCorrespondingToken(tokenContract, parlayId, false, currentBlock);
                    return {
                      yesTokenId: tokenId.toString(),
                      noTokenId: noTokenId,
                    };
                  } else {
                    // Find the corresponding YES token
                    const yesTokenId = await findCorrespondingToken(tokenContract, parlayId, true, currentBlock);
                    return {
                      yesTokenId: yesTokenId,
                      noTokenId: tokenId.toString(),
                    };
                  }
                }
              } catch (checkError) {
                // Token might not exist or be burned, continue
                continue;
              }
            }
          }
        }
      } catch (transferError) {
        // Try next chunk
        continue;
      }
    }
  } catch (tokenError) {
    console.warn('Alternative token contract query failed:', tokenError);
  }
  
  // If all strategies fail, return null
  console.warn(`Could not find token IDs for parlay ${parlayId} using any strategy`);
  return { yesTokenId: null, noTokenId: null };
}

/**
 * Helper function to find corresponding token (YES or NO) for a parlay
 */
async function findCorrespondingToken(
  tokenContract: Contract,
  parlayId: number,
  findYes: boolean,
  currentBlock: number
): Promise<string | null> {
  // Try to find the corresponding token by checking recent mints
  // This is a fallback - ideally we'd have both token IDs from the event
  const transferFilter = tokenContract.filters.Transfer(null, null, null);
  
  for (let chunk = 0; chunk < 10; chunk++) {
    try {
      const chunkFrom = Math.max(0, currentBlock - (100 * (chunk + 1)));
      const chunkTo = currentBlock - (100 * chunk);
      
      if (chunkFrom < 0) break;
      
      const transferEvents = await tokenContract.queryFilter(transferFilter, chunkFrom, chunkTo);
      
      for (const event of transferEvents) {
        if (event instanceof EventLog) {
          const args = event.args as any;
          const from = Array.isArray(args) ? args[0] : args.from;
          const tokenId = Array.isArray(args) ? args[2] : args.tokenId;
          
          if (from && typeof from === 'string' && from.toLowerCase() === '0x0000000000000000000000000000000000000000') {
            try {
              const tokenParlayId = await tokenContract.tokenToParlayId(tokenId);
              const isYes = await tokenContract.tokenSide(tokenId);
              
              if (Number(tokenParlayId) === parlayId && isYes === findYes) {
                return tokenId.toString();
              }
            } catch (checkError) {
              continue;
            }
          }
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

// Utility functions
export { formatEther, parseEther };

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

