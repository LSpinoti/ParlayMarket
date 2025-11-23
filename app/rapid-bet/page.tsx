'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import { useWeb3 } from '../../hooks/useWeb3';
import { useEVVM } from '../../hooks/useEVVM';
import { BetLeg } from '../../lib/evvm';
import { POPULAR_SYMBOLS, getSymbolName } from '../../lib/ftso';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorDisplay from '../../components/ErrorDisplay';
import SuccessDisplay from '../../components/SuccessDisplay';

interface PriceData {
  symbol: string;
  price: string;
  timestamp: number;
}

export default function RapidBetPage() {
  const router = useRouter();
  const { account, isConnecting, connectWallet } = useWeb3();
  const {
    formattedBalance,
    isLoading: evvmLoading,
    error: evvmError,
    deposit,
    withdraw,
    placeBet,
    placeDarkPoolBet,
    refresh,
    getPrices,
  } = useEVVM(account);

  // Form state
  const [legs, setLegs] = useState<BetLeg[]>([]);
  const [stakeAmount, setStakeAmount] = useState('');
  const [expiryHours, setExpiryHours] = useState('24');
  const [isDarkPool, setIsDarkPool] = useState(false);

  // Modal state
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Prices
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch prices on mount
  useEffect(() => {
    const fetchPrices = async () => {
      setLoadingPrices(true);
      try {
        const symbols = POPULAR_SYMBOLS.slice(0, 10).map((s) => s.symbol);
        const priceData = await getPrices(symbols);
        setPrices(
          priceData.map((p) => ({
            symbol: p.symbol,
            price: p.price,
            timestamp: p.timestamp,
          }))
        );
      } catch (err) {
        console.error('Failed to fetch prices:', err);
      } finally {
        setLoadingPrices(false);
      }
    };

    if (account) {
      fetchPrices();
    }
  }, [account, getPrices]);

  // Add a leg
  const addLeg = (symbol: string, targetPrice: string, isOver: boolean) => {
    setLegs([
      ...legs,
      {
        symbol,
        targetPrice: ethers.parseEther(targetPrice).toString(),
        isOver,
      },
    ]);
  };

  // Remove a leg
  const removeLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };

  // Calculate potential payout
  const calculatePayout = () => {
    if (!stakeAmount || legs.length === 0) return '0';
    const multiplier = Math.pow(2, legs.length);
    return (parseFloat(stakeAmount) * multiplier).toFixed(4);
  };

  // Handle deposit
  const handleDeposit = async () => {
    if (!depositAmount) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await deposit(depositAmount);
      setShowDeposit(false);
      setDepositAmount('');
      setSuccess('Deposit successful!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await withdraw(withdrawAmount);
      setShowWithdraw(false);
      setWithdrawAmount('');
      setSuccess('Withdrawal successful!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle bet submission
  const handleSubmitBet = async () => {
    if (!stakeAmount || legs.length === 0) {
      setError('Please add at least one leg and enter a stake amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const expiry = Math.floor(Date.now() / 1000) + parseInt(expiryHours) * 3600;

      let intentId: string;
      if (isDarkPool) {
        intentId = await placeDarkPoolBet(legs, stakeAmount, expiry);
        setSuccess(`Dark Pool bet committed! ID: ${intentId.slice(0, 10)}...`);
      } else {
        intentId = await placeBet(legs, stakeAmount, expiry);
        setSuccess(`Bet submitted! ID: ${intentId}`);
      }

      // Reset form
      setLegs([]);
      setStakeAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bet');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not connected
  if (!account) {
    return (
      <div className="min-h-screen bg-gray-950 p-8">
        <div className="max-w-4xl mx-auto text-center py-20">
          <h1 className="text-4xl font-bold text-white mb-4">FlareBet Pro</h1>
          <p className="text-gray-400 mb-8">
            Rapid-fire betting with virtual balances and Dark Pool privacy
          </p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">FlareBet Pro</h1>
            <p className="text-gray-400">Rapid Fire Betting</p>
          </div>
          <button
            onClick={refresh}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Refresh
          </button>
        </div>

        {/* Notifications */}
        {success && (
          <div className="mb-4">
            <SuccessDisplay message={success} />
          </div>
        )}
        {(error || evvmError) && (
          <div className="mb-4">
            <ErrorDisplay message={error || evvmError || ''} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Virtual Balance Card */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-4">Virtual Balance</h2>

            {evvmLoading ? (
              <LoadingSpinner />
            ) : formattedBalance ? (
              <div className="space-y-3">
                <div>
                  <p className="text-gray-400 text-sm">Total</p>
                  <p className="text-2xl font-bold text-white">
                    {formattedBalance.total} FLR
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Available</p>
                  <p className="text-xl text-green-400">
                    {formattedBalance.available} FLR
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Locked</p>
                  <p className="text-xl text-yellow-400">
                    {formattedBalance.locked} FLR
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No balance data</p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowDeposit(true)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Deposit
              </button>
              <button
                onClick={() => setShowWithdraw(true)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* Bet Builder */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-4">Build Your Bet</h2>

            {/* Current Legs */}
            {legs.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Selected Legs ({legs.length})
                </h3>
                <div className="space-y-2">
                  {legs.map((leg, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-800 rounded p-3"
                    >
                      <div>
                        <span className="text-white font-medium">
                          {leg.symbol}
                        </span>
                        <span className="text-gray-400 ml-2">
                          {leg.isOver ? 'OVER' : 'UNDER'}{' '}
                          {ethers.formatEther(leg.targetPrice)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeLeg(index)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price Grid */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Add Leg from Live Prices
              </h3>
              {loadingPrices ? (
                <LoadingSpinner />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {prices.map((price) => (
                    <div
                      key={price.symbol}
                      className="bg-gray-800 rounded p-3"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-medium">
                          {price.symbol}
                        </span>
                        <span className="text-gray-400 text-sm">
                          ${parseFloat(price.price).toFixed(4)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            addLeg(
                              price.symbol,
                              (parseFloat(price.price) * 1.05).toString(),
                              true
                            )
                          }
                          className="flex-1 px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded hover:bg-green-600/30"
                        >
                          Over +5%
                        </button>
                        <button
                          onClick={() =>
                            addLeg(
                              price.symbol,
                              (parseFloat(price.price) * 0.95).toString(),
                              false
                            )
                          }
                          className="flex-1 px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                        >
                          Under -5%
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stake & Options */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Stake (FLR)
                </label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Expiry (hours)
                </label>
                <select
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">1 week</option>
                </select>
              </div>
            </div>

            {/* Dark Pool Toggle */}
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="darkPool"
                checked={isDarkPool}
                onChange={(e) => setIsDarkPool(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="darkPool" className="text-gray-400">
                Dark Pool (Hide bet from mempool)
              </label>
            </div>

            {/* Payout Preview */}
            <div className="bg-gray-800 rounded p-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Potential Payout</span>
                <span className="text-2xl font-bold text-green-400">
                  {calculatePayout()} FLR
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {legs.length} leg{legs.length !== 1 ? 's' : ''} @ {Math.pow(2, legs.length)}x
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitBet}
              disabled={isSubmitting || legs.length === 0 || !stakeAmount}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Signing...'
                : isDarkPool
                ? 'Place Dark Pool Bet'
                : 'Place Bet'}
            </button>
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Deposit to Virtual Balance
            </h3>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount in FLR"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeposit(false)}
                className="flex-1 px-4 py-2 border border-gray-700 text-gray-400 rounded hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeposit}
                disabled={isSubmitting || !depositAmount}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Depositing...' : 'Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Withdraw from Virtual Balance
            </h3>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Amount in FLR"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white mb-4"
            />
            <p className="text-sm text-gray-400 mb-4">
              Available: {formattedBalance?.available || '0'} FLR
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWithdraw(false)}
                className="flex-1 px-4 py-2 border border-gray-700 text-gray-400 rounded hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={isSubmitting || !withdrawAmount}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
