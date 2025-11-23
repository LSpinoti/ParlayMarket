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
  conditionId: string;
  requiredOutcome: number;
  description: string;
  name: string;
  image?: string;
}

export default function CreateParlayPage() {
  const router = useRouter();
  const { isConnected, connect } = useWeb3();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parlayName, setParlayName] = useState('');
  const [legs, setLegs] = useState<MarketLeg[]>([
    { conditionId: '', requiredOutcome: 1, description: '', name: '', image: undefined },
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
      conditionId: conditionIdToBytes32(market.conditionId),
      requiredOutcome: outcome === 'yes' ? 1 : 0,
      description: market.question,
      name: market.question,
      image: market.image,
    };
    
    // If leg 1 (index 0) is empty, overwrite it instead of adding a new leg
    if (legs.length > 0 && legs[0].conditionId === '') {
      const updatedLegs = [...legs];
      updatedLegs[0] = newLeg;
      setLegs(updatedLegs);
    } else {
      setLegs([...legs, newLeg]);
    }
    
    setShowMarketBrowser(false);
  };

  const addLeg = () => {
    setLegs([...legs, { conditionId: '', requiredOutcome: 1, description: '', name: '', image: undefined }]);
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
      if (!parlayName.trim()) {
        throw new Error('Parlay name is required');
      }
      if (legs.some(leg => !leg.conditionId)) {
        throw new Error('All condition IDs must be filled');
      }
      if (legs.some(leg => !leg.name.trim())) {
        throw new Error('All leg names must be filled');
      }
      if (!makerStake || parseFloat(makerStake) <= 0) {
        throw new Error('Maker stake must be positive');
      }
      if (!takerStake || parseFloat(takerStake) <= 0) {
        throw new Error('Taker stake must be positive');
      }

      const contract = await getParlayMarketContract('coston2');
      
      const conditionIds = legs.map(leg => leg.conditionId);
      const requiredOutcomes = legs.map(leg => leg.requiredOutcome);
      const legNames = legs.map(leg => leg.name.trim() || leg.description.trim());
      const imageUrls = legs.map(leg => leg.image || '');
      const expiryTimestamp = Math.floor(Date.now() / 1000) + parseInt(expiryDays) * 24 * 60 * 60;

      const tx = await contract.createParlay(
        parlayName.trim(),
        conditionIds,
        requiredOutcomes,
        legNames,
        imageUrls,
        parseEther(takerStake),
        expiryTimestamp,
        makerIsYes,
        { value: parseEther(makerStake) }
      );

      await tx.wait();
      
      // Redirect to browse page
      router.push('/');
    } catch (err: any) {
      console.error('Error creating parlay:', err);
      setError(err.message || 'Failed to create parlay');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pt-16">
      <h1 className="text-4xl font-bold mb-8">Create Parlay</h1>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Parlay Name */}
        <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl">
          <h2 className="text-xl font-bold mb-4">Parlay Name</h2>
          <input
            type="text"
            value={parlayName}
            onChange={(e) => setParlayName(e.target.value)}
            placeholder="Enter a name for your parlay (e.g., 'Election 2024 Parlay')"
            className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"

          />
        </div>

        {/* Market Browser */}
        {showMarketBrowser && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/10">
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
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSearch}
                    className="px-6 py-2 bg-white text-black hover:bg-gray-200 rounded-2xl font-semibold transition-colors"
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
                        className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:border-white/20 transition-colors"
                      >
                        <div className="flex justify-between items-center gap-4">
                          {/* Market Image on the left */}
                          <div className="flex-shrink-0">
                            {market.image ? (
                              // If the market has a proper image property
                              <img
                                src={market.image}
                                alt={market.question}
                                className="w-14 h-14 rounded-2xl object-cover bg-gray-700 border border-white/10"
                              />
                            ) : (
                              // Fallback placeholder image
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-700 border border-white/10 text-gray-400 text-xl font-bold">
                                🪧
                              </div>
                            )}
                          </div>
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
                              className="px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-2xl text-sm font-semibold transition-colors min-w-[80px]"
                            >
                              YES
                              <div className="text-xs opacity-80">{(market.yesPrice * 100).toFixed(0)}¢</div>
                            </button>
                            <button
                              onClick={() => addMarketToParlay(market, 'no')}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-2xl text-sm font-semibold transition-colors min-w-[80px]"
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
        <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Market Legs</h2>
          </div>

          <div className="space-y-4">
            {legs.map((leg, index) => (
              <div key={index} className="p-4 bg-white/5 backdrop-blur-xl/50 border border-white/10 rounded-2xl">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    {leg.image ? (
                      <img
                        src={leg.image}
                        alt={leg.description || 'Market'}
                        className="w-14 h-14 rounded-2xl object-cover bg-gray-700 border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gray-700 border border-white/10 text-gray-400 text-xl font-bold shrink-0">
                        🪧
                      </div>
                    )}
                    <input
                      type="text"
                      value={leg.description}
                      onChange={(e) => updateLeg(index, 'description', e.target.value)}
                      placeholder="Market description"
                      className="text-sm text-gray-400 bg-transparent border-none outline-none focus:outline-none focus:bg-white/5 backdrop-blur-xl px-2 py-1 rounded flex-1 transition-colors"
                    />
                  </div>
                  {legs.length > 1 && (
                    <button
                      onClick={() => removeLeg(index)}
                      className="text-red-500 hover:text-red-400 text-sm shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Leg Name *
                    </label>
                    <input
                      type="text"
                      value={leg.name}
                      onChange={(e) => updateLeg(index, 'name', e.target.value)}
                      placeholder="Enter a name for this leg"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Polymarket Condition ID (bytes32)
                    </label>
                    <input
                      type="text"
                      value={leg.conditionId}
                      onChange={(e) => updateLeg(index, 'conditionId', e.target.value)}
                      placeholder="0x1234..."
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Required Outcome for Parlay Win
                    </label>
                    <select
                      value={leg.requiredOutcome}
                      onChange={(e) => updateLeg(index, 'requiredOutcome', parseInt(e.target.value))}
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"
                    >
                      <option value={0}>NO</option>
                      <option value={1}>YES</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setShowMarketBrowser(true)}
              className="w-1/2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-2xl text-sm font-semibold transition-colors"
            >
              Browse Markets
            </button>
            <button
              onClick={addLeg}
              className="w-1/2 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-2xl text-sm font-semibold transition-colors"
            >
              + Manual Entry
            </button>
          </div>
        </div>

        {/* Collateral & Terms */}
        <div className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl">
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
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"
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
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"
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
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-2xl focus:outline-none focus:border-blue-500"
              />
            </div>

            {makerStake && takerStake && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
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
          className="w-full py-4 bg-white text-black hover:bg-gray-200 disabled:bg-gray-600 rounded-2xl font-bold text-lg transition-colors"
        >
          {isCreating ? 'Creating Parlay...' : isConnected ? 'Create Parlay' : 'Connect Wallet to Create'}
        </button>
      </div>
    </div>
  );
}

