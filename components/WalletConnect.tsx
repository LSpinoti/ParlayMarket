'use client';

import { useWeb3 } from '@/hooks/useWeb3';
import { isMetaMaskInstalled } from '@/lib/web3';
import { useState, useEffect } from 'react';

export default function WalletConnect() {
  const { account, isConnected, isConnecting, error, connect, disconnect } = useWeb3();
  const [hasMetaMask, setHasMetaMask] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if MetaMask is installed on mount
    setHasMetaMask(isMetaMaskInstalled());
  }, []);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleConnect = async () => {
    if (!hasMetaMask) {
      // Open MetaMask installation page in new tab
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    try {
      await connect('coston2');
    } catch (err: any) {
      // Error handling is done in useWeb3 hook
    }
  };

  // Show loading state while checking for MetaMask
  if (hasMetaMask === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      {error && !error.includes('METAMASK_NOT_INSTALLED') && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      
      {isConnected ? (
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-500/10 backdrop-blur-xl border border-green-500/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="text-green-500 font-mono text-sm">{formatAddress(account!)}</span>
          </div>
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-full text-red-500 hover:bg-red-500/20 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-red-500/30"
          >
            Disconnect
          </button>
        </div>
      ) : !hasMetaMask ? (
        <button
          onClick={handleConnect}
          className="px-6 py-2 bg-orange-600/20 backdrop-blur-xl border border-orange-500/30 text-white font-semibold rounded-full transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-orange-600/30 hover:border-orange-500/40 flex items-center gap-2"
        >
          <span>🦊</span>
          <span>Install MetaMask</span>
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="px-6 py-2 bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 text-white font-semibold rounded-full transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-blue-600/30 hover:border-blue-500/40 disabled:bg-neutral-600/20 disabled:border-neutral-600/30 disabled:opacity-50"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}

