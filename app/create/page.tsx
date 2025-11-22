'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWeb3 } from '@/hooks/useWeb3';
import { getParlayMarketContract, parseEther } from '@/lib/web3';
import { 
  fetchSimplifiedMarkets, 
  SimplifiedMarket,
  conditionIdToBytes32,
  formatMarketEndDate
} from '@/lib/polymarket';

interface MarketLeg {
  umaId: string;
  requiredOutcome: number;
  description: string;
}

export default function CreateParlayPage() {
  const router = useRouter();
  const { isConnected, connect } = useWeb3();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [legs, setLegs] = useState<MarketLeg[]>([
    { umaId: '', requiredOutcome: 1, description: '' },
  ]);
  const [makerStake, setMakerStake] = useState('');
  const [takerStake, setTakerStake] = useState('');
  const [makerIsYes, setMakerIsYes] = useState(true);
  const [expiryDays, setExpiryDays] = useState('7');

  // Polymarket integration state
  const [markets, setMarkets] = useState<SimplifiedMarket[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMarketBrowser, setShowMarketBrowser] = useState(false);

  // Fetch markets on component mount
  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    setIsLoadingMarkets(true);
    const fetchedMarkets = await fetchSimplifiedMarkets({ limit: 100 });
    setMarkets(fetchedMarkets);
    setIsLoadingMarkets(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMarkets();
      return;
    }
    
    setIsLoadingMarkets(true);
    const searchResults = await fetchSimplifiedMarkets({ 
      searchQuery: searchQuery.trim(),
      limit: 50 
    });
    setMarkets(searchResults);
    setIsLoadingMarkets(false);
  };

  const addMarketToParlay = (market: SimplifiedMarket, outcome: 'yes' | 'no') => {
    const newLeg: MarketLeg = {
      umaId: conditionIdToBytes32(market.conditionId),
      requiredOutcome: outcome === 'yes' ? 1 : 0,
      description: market.question,
    };
    setLegs([...legs, newLeg]);
    setShowMarketBrowser(false);
  };

  const addLeg = () => {
    setLegs([...legs, { umaId: '', requiredOutcome: 1, description: '' }]);
  };

  const removeLeg = (index: number) => {
    if (legs.length > 1) {
      setLegs(legs.filter((_, i) => i !== index));
    }
  };

  const updateLeg = (index: number, field: keyof MarketLeg, value: string | number) => {
    const newLegs = [...legs];
    newLegs[index] = { ...newLegs[index], [field]: value };
    setLegs(newLegs);
  };

  const handleCreate = async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      // Validate inputs
      if (legs.some(leg => !leg.umaId)) {
        throw new Error('All UMA IDs must be filled');
      }
      if (!makerStake || parseFloat(makerStake) <= 0) {
        throw new Error('Maker stake must be positive');
      }
      if (!takerStake || parseFloat(takerStake) <= 0) {
        throw new Error('Taker stake must be positive');
      }

      const contract = await getParlayMarketContract('coston2');
      
      const umaIds = legs.map(leg => leg.umaId);
      const requiredOutcomes = legs.map(leg => leg.requiredOutcome);
      const expiryTimestamp = Math.floor(Date.now() / 1000) + parseInt(expiryDays) * 24 * 60 * 60;

      const tx = await contract.createParlay(
        umaIds,
        requiredOutcomes,
        parseEther(takerStake),
        expiryTimestamp,
        makerIsYes,
        { value: parseEther(makerStake) }
      );

      await tx.wait();
      
      // Redirect to browse page
      router.push('/browse');
    } catch (err: any) {
      console.error('Error creating parlay:', err);
      setError(err.message || 'Failed to create parlay');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Create Parlay</h1>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Market Browser */}
        {showMarketBrowser && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Browse Polymarket Markets</h2>
                  <button
                    onClick={() => setShowMarketBrowser(false)}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search markets (e.g., Bitcoin, Trump, Election)..."
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSearch}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingMarkets ? (
                  <div className="text-center py-12 text-gray-400">
                    Loading markets...
                  </div>
                ) : markets.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No markets found
                  </div>
                ) : (
                  <div className="space-y-3">
                    {markets.map((market) => (
                      <div
                        key={market.id}
                        className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1">{market.question}</h3>
                            {market.description && (
                              <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                                {market.description}
                              </p>
                            )}
                            <div className="flex gap-4 text-xs text-gray-500">
                              {market.category && (
                                <span className="px-2 py-1 bg-gray-700 rounded">
                                  {market.category}
                                </span>
                              )}
                              <span>Ends: {formatMarketEndDate(market.endDate)}</span>
                              {market.volume && (
                                <span>Vol: ${(market.volume / 1000).toFixed(0)}k</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => addMarketToParlay(market, 'yes')}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors min-w-[80px]"
                            >
                              YES
                              <div className="text-xs opacity-80">{(market.yesPrice * 100).toFixed(0)}¢</div>
                            </button>
                            <button
                              onClick={() => addMarketToParlay(market, 'no')}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors min-w-[80px]"
                            >
                              NO
                              <div className="text-xs opacity-80">{(market.noPrice * 100).toFixed(0)}¢</div>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Market Legs */}
        <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Market Legs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMarketBrowser(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors"
              >
                📊 Browse Markets
              </button>
              <button
                onClick={addLeg}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors"
              >
                + Manual Entry
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {legs.map((leg, index) => (
              <div key={index} className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-300">Leg {index + 1}</h3>
                  {legs.length > 1 && (
                    <button
                      onClick={() => removeLeg(index)}
                      className="text-red-500 hover:text-red-400 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Polymarket UMA ID (bytes32)
                    </label>
                    <input
                      type="text"
                      value={leg.umaId}
                      onChange={(e) => updateLeg(index, 'umaId', e.target.value)}
                      placeholder="0x1234..."
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Description (optional, for your reference)
                    </label>
                    <input
                      type="text"
                      value={leg.description}
                      onChange={(e) => updateLeg(index, 'description', e.target.value)}
                      placeholder="e.g., Bitcoin above $100k by EOY"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Required Outcome for Parlay Win
                    </label>
                    <select
                      value={leg.requiredOutcome}
                      onChange={(e) => updateLeg(index, 'requiredOutcome', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                    >
                      <option value={0}>NO (0)</option>
                      <option value={1}>YES (1)</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collateral & Terms */}
        <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
          <h2 className="text-xl font-bold mb-4">Collateral & Terms</h2>

          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Your Stake (FLR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={makerStake}
                  onChange={(e) => setMakerStake(e.target.value)}
                  placeholder="10.0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Taker Stake (FLR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={takerStake}
                  onChange={(e) => setTakerStake(e.target.value)}
                  placeholder="10.0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Your Position
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={makerIsYes}
                    onChange={() => setMakerIsYes(true)}
                    className="w-4 h-4"
                  />
                  <span>YES (All outcomes must match)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!makerIsYes}
                    onChange={() => setMakerIsYes(false)}
                    className="w-4 h-4"
                  />
                  <span>NO (At least one fails)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Expiry (days from now if unfilled)
              </label>
              <input
                type="number"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                min="1"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>

            {makerStake && takerStake && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">Total Pot:</div>
                <div className="text-2xl font-bold text-blue-500">
                  {(parseFloat(makerStake) + parseFloat(takerStake)).toFixed(2)} FLR
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-bold text-lg transition-colors"
        >
          {isCreating ? 'Creating Parlay...' : isConnected ? 'Create Parlay' : 'Connect Wallet to Create'}
        </button>
      </div>
    </div>
  );
}

