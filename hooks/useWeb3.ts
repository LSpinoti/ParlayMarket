'use client';

import { useState, useEffect, useCallback } from 'react';
import { connectWallet, getCurrentAccount, switchToFlareNetwork } from '@/lib/web3';
import { ChainName } from '@/lib/contracts';

export function useWeb3() {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already connected
    getCurrentAccount().then(setAccount).catch(console.error);

    // Listen for account changes
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        setAccount(accounts[0] || null);
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  const connect = useCallback(async (chain: ChainName = 'coston2') => {
    setIsConnecting(true);
    setError(null);
    try {
      await switchToFlareNetwork(chain);
      const addr = await connectWallet();
      setAccount(addr);
      return addr;
    } catch (err: any) {
      let message = err.message || 'Failed to connect wallet';
      
      // Don't show MetaMask not installed error - handled by WalletConnect component
      if (message === 'METAMASK_NOT_INSTALLED') {
        message = 'Please install MetaMask to continue';
      }
      
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount(null);
  }, []);

  return {
    account,
    isConnected: !!account,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}

