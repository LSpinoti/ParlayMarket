'use client';

import Link from 'next/link';
import { ParlayData, getParlayStatusString, getOutcomeString } from '@/lib/contracts';
import { formatEther } from 'ethers';

interface ParlayCardProps {
  parlay: ParlayData;
}

export default function ParlayCard({ parlay }: ParlayCardProps) {
  const status = getParlayStatusString(parlay.status);
  const totalPayout = parlay.makerStake + parlay.takerStake;
  const isExpired = parlay.expiry * 1000 < Date.now();

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
            <h3 className="text-xl font-bold text-white mb-2">Parlay #{parlay.id}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[status]}`}>
              {status}
            </span>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">Total Pot</div>
            <div className="text-2xl font-bold text-white">{formatEther(totalPayout)} FLR</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Legs:</span>
            <span className="text-white font-semibold">{parlay.conditionIds?.length || 0} markets</span>
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

          <div className="pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-2">Required Outcomes:</div>
            <div className="flex flex-wrap gap-2">
              {parlay.requiredOutcomes.map((outcome, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300"
                >
                  Market {idx + 1}: {getOutcomeString(outcome)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

