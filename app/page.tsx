'use client';

import Link from 'next/link';
import { useParlays } from '@/hooks/useParlays';
import ParlayCard from '@/components/ParlayCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useState } from 'react';
import { getParlayStatusString } from '@/lib/contracts';

export default function Home() {
  const { parlays, isLoading, error, refresh } = useParlays('coston2');
  const [filter, setFilter] = useState<'all' | 'created' | 'filled' | 'resolved'>('all');

  const filteredParlays = parlays.filter(parlay => {
    if (filter === 'all') return true;
    const status = getParlayStatusString(parlay.status);
    return status.toLowerCase() === filter;
  });

  return (
    <div className="min-h-[80vh]">
      <div className="text-center max-w-4xl mx-auto mb-12">
        <h1 className="text-6xl font-bold mb-6">
          Welcome to <span className="text-blue-500">ParlayMarket</span>
        </h1>
        
        <p className="text-xl text-gray-400 mb-12 leading-relaxed">
          The first fully collateralized parlay marketplace on <span className="text-orange-500 font-semibold">Flare Network</span>.
          Create multi-leg parlays, trade positions as tokens, and settle using Polymarket's API resolution data.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-xl font-bold mb-2">Create Parlays</h3>
            <p className="text-gray-400 text-sm">
              Combine multiple Polymarket markets into a single parlay bet with custom odds
            </p>
          </div>

          <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="text-4xl mb-3">💎</div>
            <h3 className="text-xl font-bold mb-2">Trade Positions</h3>
            <p className="text-gray-400 text-sm">
              YES/NO positions are ERC-721 tokens - tradable on secondary markets
            </p>
          </div>

          <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-xl font-bold mb-2">Trust-Minimized</h3>
            <p className="text-gray-400 text-sm">
              Settlements use Polymarket's API resolution data - no custom oracle logic needed
            </p>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/create"
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-lg transition-colors"
          >
            Create Parlay
          </Link>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-800">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mb-2 mx-auto">1</div>
              <p className="text-gray-400">Maker creates parlay and deposits collateral</p>
            </div>
            <div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mb-2 mx-auto">2</div>
              <p className="text-gray-400">Taker fills opposite side with matching stake</p>
            </div>
            <div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mb-2 mx-auto">3</div>
              <p className="text-gray-400">YES/NO tokens minted and tradable</p>
            </div>
            <div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mb-2 mx-auto">4</div>
              <p className="text-gray-400">Settlement via Polymarket API when markets resolve</p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Parlays Section */}
      <div className="max-w-7xl mx-auto mt-16">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-4xl font-bold">Available Parlays</h2>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-8">
          {['all', 'created', 'filled', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner size="lg" />
        ) : filteredParlays.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold mb-2">No Parlays Found</h3>
            <p className="text-gray-400">
              {filter === 'all' 
                ? 'Be the first to create a parlay!'
                : `No ${filter} parlays at the moment.`
              }
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredParlays.map((parlay) => (
              <ParlayCard key={parlay.id} parlay={parlay} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
