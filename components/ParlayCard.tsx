'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ParlayData, getParlayStatusString, getOutcomeString } from '@/lib/contracts';
import { formatEther } from 'ethers';

interface ParlayCardProps {
  parlay: ParlayData;
}

export default function ParlayCard({ parlay }: ParlayCardProps) {
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const status = getParlayStatusString(parlay.status);
  const totalPayout = parlay.makerStake + parlay.takerStake;
  const isExpired = parlay.expiry * 1000 < Date.now();
  
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

  return (
    <Link href={`/parlay/${parlay.id}`}>
      <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl hover:border-blue-500/50 transition-all cursor-pointer">
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
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Legs:</span>
            <span className="text-white font-semibold">{parlay.conditionIds?.length || 0}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Maker Stake:</span>
            <span className="text-white">{formatEther(parlay.makerStake)} FLR</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Taker Stake:</span>
            <span className="text-white">{formatEther(parlay.takerStake)} FLR</span>
          </div>

          {status === 'Created' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Expires:</span>
              <span className={isExpired ? 'text-red-500' : 'text-white'}>
                {new Date(parlay.expiry * 1000).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

