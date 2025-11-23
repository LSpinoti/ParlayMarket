'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ParlayData, getParlayStatusString, getOutcomeString } from '@/lib/contracts';
import { formatEther } from 'ethers';
import { useWeb3 } from '@/hooks/useWeb3';

interface ParlayCardProps {
  parlay: ParlayData;
}

export default function ParlayCard({ parlay }: ParlayCardProps) {
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
    ? `Available for ${parlay.makerIsYes ? 'NO' : 'YES'}`
    : status;

  const statusColors: Record<string, string> = {
    Created: 'bg-green-500/20 text-green-400 border-green-500/30',
    Filled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Resolved: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Cancelled: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
    Invalid: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  // Card border colors based on status
  const cardBorderColors: Record<string, string> = {
    Created: 'border-green-500/30 hover:border-green-500/50',
    Filled: 'border-blue-500/30 hover:border-blue-500/50',
    Resolved: 'border-purple-500/30 hover:border-purple-500/50',
    Cancelled: 'border-neutral-600 hover:border-neutral-500',
    Invalid: 'border-red-500/30 hover:border-red-500/50',
  };

  // Yellow border if user is in this parlay
  const borderClass = isInParlay
    ? 'border-yellow-500/30 hover:border-yellow-500/50'
    : cardBorderColors[status];

  return (
    <Link href={`/parlay/${parlay.id}`}>
      <div className={`p-4 bg-neutral-800/50 border rounded-xl transition-all cursor-pointer h-[240px] flex flex-col ${borderClass}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">
              {parlay.name || `Parlay #${parlay.id}`}
            </h3>
            <div className="flex gap-2 items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] ${statusColors[status]}`}>
                {displayStatus}
              </span>
              {isInParlay && userSide && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  Your Position: {userSide}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Market Images */}
        {parlay.imageUrls && parlay.imageUrls.length > 0 && (
          <div className="mb-4 overflow-y-scroll max-h-[103px] space-y-2 flex-1">
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
                        <div className="w-14 h-14 rounded-lg bg-neutral-700 border border-neutral-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                          {showPlaceholder ? (
                            <div className="text-neutral-400 text-xl font-bold">🪧</div>
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
                        <div className="text-xs text-neutral-300 flex-1 line-clamp-3" title={legName}>
                          {legName}
                        </div>
                      </div>
                    );
                  })}
                  {needsDummy && (
                    <div className="flex items-center gap-2 flex-1 min-w-0 invisible">
                      <div className="w-14 h-14 rounded-lg bg-neutral-700 border border-neutral-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                        <div className="text-neutral-400 text-xl font-bold">🪧</div>
                      </div>
                      <div className="text-xs text-neutral-300 flex-1 line-clamp-3">
                        Placeholder
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-1 mt-auto">
          <div className="grid grid-cols-2 gap-x-8">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Legs:</span>
                <span className="text-white font-semibold">{parlay.conditionIds?.length || 0}</span>
              </div>

              {status === 'Created' && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Expires:</span>
                  <span className={isExpired ? 'text-red-500' : 'text-white'}>
                    {new Date(parlay.expiry * 1000).toISOString().slice(0, 10)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Maker Stake:</span>
                <span className="text-white">{formatEther(parlay.makerStake)} FLR</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Taker Stake:</span>
                <span className="text-white">{formatEther(parlay.takerStake)} FLR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

