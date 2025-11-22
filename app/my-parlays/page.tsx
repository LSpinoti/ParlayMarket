'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '@/hooks/useWeb3';
import { getProvider } from '@/lib/web3';
import { CONTRACT_ADDRESSES } from '@/lib/contracts';
import LoadingSpinner from '@/components/LoadingSpinner';

interface UserPosition {
  tokenId: number;
  parlayId: number;
  isYes: boolean;
}

const PARLAY_TOKEN_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenToParlayId(uint256 tokenId) external view returns (uint256)',
  'function tokenSide(uint256 tokenId) external view returns (bool)',
];

export default function MyParlaysPage() {
  const { account, isConnected, connect } = useWeb3();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!account) {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = await getProvider();
      const parlayTokenAddress = CONTRACT_ADDRESSES.coston2.ParlayToken;

      if (!parlayTokenAddress || parlayTokenAddress === '0x0000000000000000000000000000000000000000') {
        setError('ParlayToken address not configured');
        setIsLoading(false);
        return;
      }

      const parlayToken = new ethers.Contract(parlayTokenAddress, PARLAY_TOKEN_ABI, provider);
      const foundPositions: UserPosition[] = [];

      // Get user's token balance
      let balance = 0;
      try {
        balance = Number(await parlayToken.balanceOf(account));
      } catch (err) {
        console.error('Error getting balance:', err);
        setError('Failed to get token balance');
        setIsLoading(false);
        return;
      }

      if (balance === 0) {
        setPositions([]);
        setIsLoading(false);
        return;
      }

      // Scan for user's tokens
      let foundCount = 0;
      for (let tokenId = 0; tokenId < 500 && foundCount < balance; tokenId++) {
        try {
          const owner = await parlayToken.ownerOf(tokenId);
          if (owner.toLowerCase() === account.toLowerCase()) {
            foundCount++;
            const parlayId = await parlayToken.tokenToParlayId(tokenId);
            const isYes = await parlayToken.tokenSide(tokenId);

            foundPositions.push({
              tokenId,
              parlayId: Number(parlayId),
              isYes,
            });
          }
        } catch (err) {
          // Token doesn't exist - continue
        }
      }

      setPositions(foundPositions);
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch positions');
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
        <p className="text-gray-400 mb-6">Connect your wallet to view your positions</p>
        <button
          onClick={() => connect()}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Positions</h1>
        <button
          onClick={fetchPositions}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner size="lg" />
      ) : positions.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-2">No Positions Yet</h2>
          <p className="text-gray-400 mb-6">You don't hold any parlay position tokens</p>
          <a
            href="/create"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            Create Your First Parlay
          </a>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {positions.map((position) => (
            <div
              key={position.tokenId}
              className="bg-gray-900 rounded-xl p-6 border border-gray-800"
            >
              <div className="flex justify-between items-start mb-4">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded ${
                    position.isYes
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-red-600/20 text-red-400'
                  }`}
                >
                  {position.isYes ? 'YES' : 'NO'}
                </span>
                <span className="text-gray-500 text-sm">Token #{position.tokenId}</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Parlay #{position.parlayId}
              </h3>

              <p className="text-gray-400 text-sm mb-4">
                You hold the {position.isYes ? 'YES' : 'NO'} position for this parlay
              </p>

              <a
                href="/marketplace"
                className="block w-full py-2 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700"
              >
                Sell on Marketplace
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
