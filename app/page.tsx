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
      {/* Available Parlays Section */}
      <div className="max-w-7xl mx-auto mb-16">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-4xl font-bold">Available Parlays</h2>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/10 hover:border-white/20"
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
              className={`px-4 py-2 rounded-full font-semibold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] ${
                filter === f
                  ? 'bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 text-white hover:bg-blue-600/30 hover:border-blue-500/40'
                  : 'bg-white/5 backdrop-blur-xl border border-white/10 text-neutral-400 hover:bg-white/10 hover:border-white/20 hover:text-white'
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
            <p className="text-neutral-400">
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
