'use client';

import { useParlays } from '@/hooks/useParlays';
import { useWeb3 } from '@/hooks/useWeb3';
import ParlayCard from '@/components/ParlayCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function MyParlaysPage() {
  const { account, isConnected, connect } = useWeb3();
  const { parlays, isLoading, error, refresh } = useParlays('coston2');

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
        <p className="text-neutral-400 mb-6">Connect your wallet to view your parlays</p>
        <button
          onClick={() => connect()}
          className="px-8 py-3 bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 rounded-full font-semibold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-blue-600/30 hover:border-blue-500/40"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const myParlays = parlays.filter(
    (parlay) =>
      parlay.maker.toLowerCase() === account?.toLowerCase() ||
      parlay.taker.toLowerCase() === account?.toLowerCase()
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">My Parlays</h1>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/10 hover:border-white/20"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner size="lg" />
      ) : myParlays.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-2">No Parlays Yet</h2>
          <p className="text-neutral-400 mb-6">You haven't created or filled any parlays</p>
          <a
            href="/create"
            className="inline-block px-8 py-3 bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 rounded-full font-semibold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-blue-600/30 hover:border-blue-500/40"
          >
            Create Your First Parlay
          </a>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myParlays.map((parlay) => (
            <ParlayCard key={parlay.id} parlay={parlay} />
          ))}
        </div>
      )}
    </div>
  );
}

