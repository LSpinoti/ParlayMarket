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
 * Get token IDs for a parlay by reading directly from contract storage
 * This is much faster than searching through blocks!
 * @param parlayId The parlay ID
 * @param chain The chain name
 */
export async function getParlayTokenIds(
  parlayId: number,
  chain: ChainName = 'coston2'
): Promise<{ yesTokenId: string | null; noTokenId: string | null }> {
  try {
    const contract = await getParlayMarketContract(chain);
    
    // Use the public 'parlays' mapping which returns the full struct including token IDs
    // This is a direct storage read - no block searching needed!
    const parlayData = await contract.parlays(parlayId);
    
    // The mapping returns: (id, maker, taker, name, conditionIds, requiredOutcomes, 
    // legNames, imageUrls, makerStake, takerStake, expiry, status, makerIsYes, yesTokenId, noTokenId)
    // Handle both object and array return formats from ethers
    let yesTokenId: string | null = null;
    let noTokenId: string | null = null;
    
    if (Array.isArray(parlayData)) {
      // If returned as array, token IDs are at indices 13 and 14
      yesTokenId = parlayData[13]?.toString() || null;
      noTokenId = parlayData[14]?.toString() || null;
    } else if (parlayData && typeof parlayData === 'object') {
      // If returned as object with named properties
      yesTokenId = parlayData.yesTokenId?.toString() || null;
      noTokenId = parlayData.noTokenId?.toString() || null;
    }
    
    // Return token IDs if they exist and are non-zero
    if (yesTokenId && yesTokenId !== '0' && noTokenId && noTokenId !== '0') {
      return {
        yesTokenId: yesTokenId,
        noTokenId: noTokenId,
      };
    }
    
    return { yesTokenId: null, noTokenId: null };
  } catch (error: any) {
    console.warn(`Error reading token IDs from contract for parlay ${parlayId}:`, error.message);
    return { yesTokenId: null, noTokenId: null };
  }
}

/**
 * Extract token IDs from a transaction receipt
 * Use this when you have the receipt from fillParlay transaction
 * @param receipt The transaction receipt
 * @param contract The ParlayMarket contract instance
 */
export async function getTokenIdsFromReceipt(
  receipt: any,
  contract: Contract
): Promise<{ yesTokenId: string | null; noTokenId: string | null }> {
  try {
    // In ethers v6, receipt.logs contains the event logs
    // Find the ParlayFilled event in the receipt
    for (const log of receipt.logs || []) {
      try {
        // Try to parse the log using the contract interface
        const parsed = contract.interface.parseLog({
          topics: log.topics || [],
          data: log.data || '0x'
        });
        
        if (parsed && parsed.name === 'ParlayFilled' && parsed.args) {
          const yesTokenId = parsed.args.yesTokenId?.toString() || null;
          const noTokenId = parsed.args.noTokenId?.toString() || null;
          if (yesTokenId && noTokenId) {
            return { yesTokenId, noTokenId };
          }
        }
      } catch (parseError) {
        // Not the event we're looking for, continue
        continue;
      }
    }
  } catch (error) {
    console.warn('Error extracting token IDs from receipt:', error);
  }
  
  return { yesTokenId: null, noTokenId: null };
}

// Utility functions
export { formatEther, parseEther };

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

