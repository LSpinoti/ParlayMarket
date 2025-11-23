'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../../hooks/useWeb3';
import { useMarketplace, Listing, UserToken } from '../../hooks/useMarketplace';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorDisplay from '../../components/ErrorDisplay';
import SuccessDisplay from '../../components/SuccessDisplay';

export default function MarketplacePage() {
  const { account, isConnecting, connectWallet } = useWeb3();
  const {
    listings,
    userTokens,
    isLoading,
    error: marketplaceError,
    listPosition,
    buyPosition,
    cancelListing,
    updatePrice,
    refresh,
  } = useMarketplace(account);

  // UI state
  const [activeTab, setActiveTab] = useState<'browse' | 'sell'>('browse');
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle list position
  const handleList = async () => {
    if (selectedToken === null || !listPrice) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await listPosition(selectedToken, listPrice);
      setSuccess('Position listed successfully!');
      setSelectedToken(null);
      setListPrice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list position');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle buy position
  const handleBuy = async (listingId: number) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await buyPosition(listingId);
      setSuccess('Position purchased successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to buy position');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel listing
  const handleCancel = async (listingId: number) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await cancelListing(listingId);
      setSuccess('Listing cancelled successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not connected
  if (!account) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto text-center py-20 pt-16">
          <h1 className="text-4xl font-bold text-white mb-4">Parlay Marketplace</h1>
          <p className="text-gray-400 mb-8">
            Buy and sell parlay positions from other users
          </p>
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="px-6 py-3 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-full hover:bg-white/20 disabled:opacity-50 transition-all"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto pt-16">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Parlay Marketplace</h1>
            <p className="text-gray-400">Buy and sell parlay positions</p>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Notifications */}
        {success && (
          <div className="mb-4">
            <SuccessDisplay message={success} />
          </div>
        )}
        {(error || marketplaceError) && (
          <div className="mb-4">
            <ErrorDisplay message={error || marketplaceError || ''} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
              activeTab === 'browse'
                ? 'bg-white text-black'
                : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
            }`}
          >
            Browse Listings
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
              activeTab === 'sell'
                ? 'bg-white text-black'
                : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
            }`}
          >
            Sell Position
          </button>
        </div>

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <div>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No active listings</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    account={account}
                    onBuy={() => handleBuy(listing.id)}
                    onCancel={() => handleCancel(listing.id)}
                    isSubmitting={isSubmitting}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sell Tab */}
        {activeTab === 'sell' && (
          <div className="max-w-md">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <h2 className="text-xl font-semibold text-white mb-4">
                List Position for Sale
              </h2>

              {/* Select Token */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Select Position
                </label>
                {userTokens.filter((t) => !t.isListed).length === 0 ? (
                  <p className="text-gray-500">No positions available to sell</p>
                ) : (
                  <div className="space-y-2">
                    {userTokens
                      .filter((t) => !t.isListed)
                      .map((token) => (
                        <button
                          key={token.tokenId}
                          onClick={() => setSelectedToken(token.tokenId)}
                          className={`w-full p-3 rounded-2xl text-left transition-all ${
                            selectedToken === token.tokenId
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                          }`}
                        >
                          <div className="font-medium">
                            Token #{token.tokenId}
                          </div>
                          <div className="text-sm opacity-75">
                            Parlay #{token.parlayId} •{' '}
                            {token.isYes ? 'YES' : 'NO'} Position
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Price Input */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Asking Price (FLR)
                </label>
                <input
                  type="number"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Fee Notice */}
              <p className="text-sm text-gray-500 mb-4">
                1% platform fee will be deducted from sale
              </p>

              {/* List Button */}
              <button
                onClick={handleList}
                disabled={
                  isSubmitting || selectedToken === null || !listPrice
                }
                className="w-full py-3 bg-white text-black rounded-full font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? 'Listing...' : 'List for Sale'}
              </button>
            </div>

            {/* User's Active Listings */}
            {listings.filter(
              (l) => l.seller.toLowerCase() === account.toLowerCase()
            ).length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Your Active Listings
                </h3>
                <div className="space-y-3">
                  {listings
                    .filter(
                      (l) => l.seller.toLowerCase() === account.toLowerCase()
                    )
                    .map((listing) => (
                      <div
                        key={listing.id}
                        className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-white font-medium">
                              Token #{listing.tokenId}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {ethers.formatEther(listing.price)} FLR
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancel(listing.id)}
                            disabled={isSubmitting}
                            className="px-3 py-1 text-sm bg-white/10 text-white rounded-full hover:bg-white/20 disabled:opacity-50 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================
//                    LISTING CARD COMPONENT
// =============================================================

function ListingCard({
  listing,
  account,
  onBuy,
  onCancel,
  isSubmitting,
}: {
  listing: Listing;
  account: string;
  onBuy: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const isSeller = listing.seller.toLowerCase() === account.toLowerCase();
  const priceFormatted = ethers.formatEther(listing.price);

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-4 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              listing.isYesPosition
                ? 'bg-white/10 text-green-400 border border-green-400/30'
                : 'bg-white/10 text-red-400 border border-red-400/30'
            }`}
          >
            {listing.isYesPosition ? 'YES' : 'NO'}
          </span>
        </div>
        <span className="text-gray-500 text-sm">#{listing.id}</span>
      </div>

      {/* Details */}
      <div className="mb-3">
        <p className="text-white font-medium">Parlay #{listing.parlayId}</p>
        <p className="text-gray-400 text-sm">Token #{listing.tokenId}</p>
      </div>

      {/* Price */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-white">{priceFormatted} FLR</p>
      </div>

      {/* Seller */}
      <div className="mb-4">
        <p className="text-gray-500 text-sm">
          Seller: {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
          {isSeller && (
            <span className="ml-2 text-white/60">(You)</span>
          )}
        </p>
      </div>

      {/* Action Button */}
      {isSeller ? (
        <button
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full py-2 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 disabled:opacity-50 transition-all border border-white/10"
        >
          Cancel Listing
        </button>
      ) : (
        <button
          onClick={onBuy}
          disabled={isSubmitting}
          className="w-full py-2 bg-white text-black rounded-full font-medium hover:bg-gray-200 disabled:opacity-50 transition-all"
        >
          Buy for {priceFormatted} FLR
        </button>
      )}
    </div>
  );
}
