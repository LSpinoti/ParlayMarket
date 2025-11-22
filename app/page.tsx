import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="text-center max-w-4xl mx-auto">
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
          <Link
            href="/browse"
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-semibold text-lg transition-colors"
          >
            Browse Markets
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
    </div>
  );
}
