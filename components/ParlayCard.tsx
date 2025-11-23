'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ParlayData, getParlayStatusString, getOutcomeString } from '@/lib/contracts';
import { formatEther } from 'ethers';
import { useWeb3 } from '@/hooks/useWeb3';

interface ParlayCardProps {
  parlay: ParlayData;
  index?: number;
}

export default function ParlayCard({ parlay, index = 0 }: ParlayCardProps) {
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const { account } = useWeb3();
  const status = getParlayStatusString(parlay.status);
  const totalPayout = parlay.makerStake + parlay.takerStake;
  const isExpired = parlay.expiry * 1000 < Date.now();
  
  // Determine if user is in this parlay and which side they're on
  const isMaker = account?.toLowerCase() === parlay.maker.toLowerCase();
  const isTaker = account?.toLowerCase() === parlay.taker.toLowerCase();
  const isInParlay = isMaker || isTaker;
  const userSide = isMaker 
    ? (parlay.makerIsYes ? 'YES' : 'NO')
    : isTaker 
    ? (parlay.makerIsYes ? 'NO' : 'YES')
    : null;
  
  // Determine the display status text
  const displayStatus = status === 'Created' 
    ? `Waiting for ${parlay.makerIsYes ? 'NO' : 'YES'} taker`
    : status;

  const statusColors: Record<string, string> = {
    Created: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    Filled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    Resolved: 'bg-green-500/10 text-green-500 border-green-500/20',
    Cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    Invalid: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  // Calculate animation delay based on position from center
  // For a 3-column grid: col 0 = left, col 1 = center, col 2 = right
  const col = index % 3;
  const row = Math.floor(index / 3);
  const distanceFromCenter = Math.abs(col - 1); // 0 for center, 1 for sides
  const animationDelay = 1.2 + (row * 0.1) + (distanceFromCenter * 0.15); // 2 second initial delay

  return (
    <Link href={`/parlay/${parlay.id}`}>
      <div
        className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:border-white/30 transition-all cursor-pointer animate-fade-in font-sans"
        style={{
          animationDelay: `${animationDelay}s`,
          animationFillMode: 'backwards'
        }}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">
              {parlay.name || `Parlay #${parlay.id}`}
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[status]}`}>
              {displayStatus}
            </span>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">Total Pot</div>
            <div className="text-2xl font-bold text-white">{formatEther(totalPayout)} FLR</div>
          </div>
        </div>

        {/* Market Images */}
        {parlay.imageUrls && parlay.imageUrls.length > 0 && (
          <div className="mb-4 overflow-y-scroll max-h-[103px] space-y-2">
            {Array.from({ length: Math.ceil(parlay.imageUrls.length / 2) }).map((_, rowIdx) => {
              const startIdx = rowIdx * 2;
              const legsInRow = parlay.imageUrls.slice(startIdx, startIdx + 2);
              const isLastRow = rowIdx === Math.ceil(parlay.imageUrls.length / 2) - 1;
              const needsDummy = isLastRow && legsInRow.length === 1;
              
              return (
                <div
                  key={rowIdx}
                  className="flex gap-3"
                >
                  {legsInRow.map((imageUrl, colIdx) => {
                    const idx = startIdx + colIdx;
                    const hasFailed = failedImages.has(idx);
                    const showPlaceholder = !imageUrl || hasFailed;
                    const legName = parlay.legNames?.[idx] || `Leg ${idx + 1}`;
                    
                    return (
                      <div key={idx} className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-14 h-14 rounded-lg bg-gray-700 border border-gray-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {showPlaceholder ? (
                            <div className="text-gray-400 text-xl font-bold">🪧</div>
                          ) : (
                            <img
                              src={imageUrl}
                              alt={`Market ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={() => {
                                setFailedImages(prev => new Set(prev).add(idx));
                              }}
                            />
                          )}
                        </div>
                        <div className="text-xs text-gray-300 flex-1 line-clamp-3" title={legName}>
                          {legName}
                        </div>
                      </div>
                    );
                  })}
                  {needsDummy && (
                    <div className="flex items-center gap-2 flex-1 min-w-0 invisible">
                      <div className="w-14 h-14 rounded-lg bg-gray-700 border border-gray-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                        <div className="text-gray-400 text-xl font-bold">🪧</div>
                      </div>
                      <div className="text-xs text-gray-300 flex-1 line-clamp-3">
                        Placeholder
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-1">
          {isInParlay && userSide && (
            <div className="flex justify-between items-center text-sm mb-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <span className="text-gray-300">Your Position:</span>
              <span className={`px-2 py-1 rounded font-semibold ${
                userSide === 'YES' 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {userSide}
              </span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-x-8">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Legs:</span>
                <span className="text-white font-semibold">{parlay.conditionIds?.length || 0}</span>
              </div>

              {status === 'Created' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Expires:</span>
                  <span className={isExpired ? 'text-red-500' : 'text-white'}>
                    {new Date(parlay.expiry * 1000).toISOString().slice(0, 10)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Maker Stake:</span>
                <span className="text-white">{formatEther(parlay.makerStake)} FLR</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Taker Stake:</span>
                <span className="text-white">{formatEther(parlay.takerStake)} FLR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

