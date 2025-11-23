'use client';

import Link from 'next/link';
import { useParlays } from '@/hooks/useParlays';
import ParlayCard from '@/components/ParlayCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useState, useCallback, useEffect } from 'react';
import { getParlayStatusString } from '@/lib/contracts';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useWeb3 } from '@/hooks/useWeb3';

export default function Home() {
  const { parlays, isLoading, error, refresh } = useParlays('coston2');
  const { account } = useWeb3();
  const [filter, setFilter] = useState<'all' | 'available' | 'filled' | 'resolved'>('available');
  const [animationComplete, setAnimationComplete] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    // Only animate on first mount
    setHasAnimated(true);
  }, []);

  const dotLottieRefCallback = useCallback((dotLottie: any) => {
    if (dotLottie) {
      dotLottie.addEventListener('complete', () => {
        setAnimationComplete(true);
      });
    }
  }, []);

  const filteredParlays = parlays.filter(parlay => {
    if (filter === 'all') return true;
    const status = getParlayStatusString(parlay.status);
    if (filter === 'available') {
      // Show Created parlays that aren't made by the current user
      const isMaker = account?.toLowerCase() === parlay.maker.toLowerCase();
      return status === 'Created' && !isMaker;
    }
    return status.toLowerCase() === filter;
  });

  return (
    <div className={`min-h-[80vh] ${!hasAnimated ? 'animate-fade-in-up-initial' : ''}`}>
      {/* Hero Section with Animation */}
      <div className="relative">
        <div className="relative z-10 flex flex-col items-center px-4 pt-20">
          {/* Main heading */}
          <h1 className={`text-4xl md:text-5xl lg:text-6xl font-light text-center mb-4 tracking-tight ${!hasAnimated ? 'animate-fade-in-up-slow' : ''}`}>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
              Where Prediction Markets
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600">
              Meet True Parlays
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-gray-400 text-center max-w-xl mb-6 text-sm">
            The Future Of Prediction Markets With ParlayMarket Today.
          </p>
        </div>

        {/* Lottie Animation - behind everything except background */}
        <div className={`absolute inset-0 flex items-start justify-center pointer-events-none z-0 -mt-50 transition-opacity duration-700 ${animationComplete ? 'opacity-0' : 'opacity-80'}`}>
          <div className="w-full max-w-3xl transform rotate-90">
            <DotLottieReact
              src="https://lottie.host/bba9c817-7818-4830-b7b1-343c068425b2/mtplIxOJfh.lottie"
              autoplay
              speed={1.6}
              dotLottieRefCallback={dotLottieRefCallback}
            />
          </div>
        </div>

        {/* Available Parlays Section - overlapping animation */}
        <div className={`relative z-10 max-w-7xl mx-auto mb-16 mt-8 transition-opacity duration-700 ${animationComplete ? 'opacity-100' : 'opacity-0'}`}>
        <h2 className="text-4xl font-bold mb-8">Market</h2>

        {/* Filters */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex gap-3">
            {['available', 'filled', 'resolved', 'all'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-full font-semibold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] ${
                  filter === f
                    ? 'bg-white text-black'
                    : 'bg-white/5 backdrop-blur-xl border border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full font-semibold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/10 hover:border-white/20 text-white/60 hover:text-white"
          >
            Refresh
          </button>
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
    </div>
  );
}
