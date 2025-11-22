'use client';

import { useWeb3 } from '@/hooks/useWeb3';

export default function WalletConnect() {
  const { account, isConnected, isConnecting, error, connect, disconnect } = useWeb3();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex items-center gap-4">
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      
      {isConnected ? (
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <span className="text-green-500 font-mono text-sm">{formatAddress(account!)}</span>
          </div>
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 hover:bg-red-500/20 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          onClick={() => connect('coston2')}
          disabled={isConnecting}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}

