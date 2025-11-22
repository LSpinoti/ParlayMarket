'use client';

import { useParlays } from '@/hooks/useParlays';
import ParlayCard from '@/components/ParlayCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useState } from 'react';
import { getParlayStatusString } from '@/lib/contracts';

export default function BrowsePage() {
  const { parlays, isLoading, error, refresh } = useParlays('coston2');
  const [filter, setFilter] = useState<'all' | 'created' | 'filled' | 'resolved'>('all');

  const filteredParlays = parlays.filter(parlay => {
    if (filter === 'all') return true;
    const status = getParlayStatusString(parlay.status);
    return status.toLowerCase() === filter;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Browse Parlays</h1>
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
          <h2 className="text-2xl font-bold mb-2">No Parlays Found</h2>
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
  );
}

