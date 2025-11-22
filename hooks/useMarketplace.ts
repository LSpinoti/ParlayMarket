'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getProvider } from '../lib/web3';
import { CONTRACT_ADDRESSES, ChainName } from '../lib/contracts';

// =============================================================
//                          TYPES
// =============================================================

export interface Listing {
  id: number;
  tokenId: number;
  seller: string;
  price: bigint;
  parlayId: number;
  isYesPosition: boolean;
  active: boolean;
  listedAt: number;
}

export interface UserToken {
  tokenId: number;
  parlayId: number;
  isYes: boolean;
  isListed: boolean;
}

// =============================================================
//                           ABI
// =============================================================

const MARKETPLACE_ABI = [
  'function listPosition(uint256 tokenId, uint256 price) external returns (uint256)',
  'function buyPosition(uint256 listingId) external payable',
  'function cancelListing(uint256 listingId) external',
  'function updatePrice(uint256 listingId, uint256 newPrice) external',
  'function getListing(uint256 listingId) external view returns (tuple(uint256 tokenId, address seller, uint256 price, uint256 parlayId, bool isYesPosition, bool active, uint256 listedAt))',
  'function getListingByToken(uint256 tokenId) external view returns (uint256)',
  'function getTotalListings() external view returns (uint256)',
  'function isListed(uint256 tokenId) external view returns (bool)',
  'function feeBps() external view returns (uint256)',
  'function parlayToken() external view returns (address)',
];

const PARLAY_TOKEN_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function tokenToParlayId(uint256 tokenId) external view returns (uint256)',
  'function tokenSide(uint256 tokenId) external view returns (bool)',
  'function approve(address to, uint256 tokenId) external',
  'function getApproved(uint256 tokenId) external view returns (address)',
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address owner, address operator) external view returns (bool)',
];

// =============================================================
//                          HOOK
// =============================================================

export function useMarketplace(account: string | null, chain: ChainName = 'coston2') {
  const [listings, setListings] = useState<Listing[]>([]);
  const [userTokens, setUserTokens] = useState<UserToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================================
  //                    FETCH LISTINGS
  // =============================================================

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const provider = await getProvider();
      const marketplaceAddress = CONTRACT_ADDRESSES[chain].ParlayMarketplace;

      if (!marketplaceAddress || marketplaceAddress === '0x0000000000000000000000000000000000000000') {
        setError('Marketplace not deployed');
        setIsLoading(false);
        return;
      }

      const marketplace = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, provider);

      const totalListings = await marketplace.getTotalListings();
      const fetchedListings: Listing[] = [];

      for (let i = 1; i <= Number(totalListings); i++) {
        try {
          const listing = await marketplace.getListing(i);
          if (listing.active) {
            fetchedListings.push({
              id: i,
              tokenId: Number(listing.tokenId),
              seller: listing.seller,
              price: listing.price,
              parlayId: Number(listing.parlayId),
              isYesPosition: listing.isYesPosition,
              active: listing.active,
              listedAt: Number(listing.listedAt),
            });
          }
        } catch (err) {
          // Skip invalid listings
        }
      }

      setListings(fetchedListings);
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch listings');
    } finally {
      setIsLoading(false);
    }
  }, [chain]);

  // =============================================================
  //                    FETCH USER TOKENS
  // =============================================================

  const fetchUserTokens = useCallback(async () => {
    if (!account) {
      setUserTokens([]);
      return;
    }

    try {
      const provider = await getProvider();
      const parlayTokenAddress = CONTRACT_ADDRESSES[chain].ParlayToken;

      if (!parlayTokenAddress || parlayTokenAddress === '0x0000000000000000000000000000000000000000') {
        setError('ParlayToken address not configured');
        return;
      }

      const parlayToken = new ethers.Contract(parlayTokenAddress, PARLAY_TOKEN_ABI, provider);
      const tokens: UserToken[] = [];

      // Check marketplace if deployed
      const marketplaceAddress = CONTRACT_ADDRESSES[chain].ParlayMarketplace;
      let marketplace: ethers.Contract | null = null;
      if (marketplaceAddress && marketplaceAddress !== '0x0000000000000000000000000000000000000000') {
        marketplace = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, provider);
      }

      // Get user's token balance first
      let balance = 0;
      try {
        balance = Number(await parlayToken.balanceOf(account));
      } catch (err) {
        console.error('Error getting balance:', err);
      }

      if (balance === 0) {
        setUserTokens([]);
        return;
      }

      // Scan for user's tokens (check token IDs)
      let foundCount = 0;
      for (let tokenId = 0; tokenId < 500 && foundCount < balance; tokenId++) {
        try {
          const owner = await parlayToken.ownerOf(tokenId);
          if (owner.toLowerCase() === account.toLowerCase()) {
            foundCount++;
            const parlayId = await parlayToken.tokenToParlayId(tokenId);
            const isYes = await parlayToken.tokenSide(tokenId);

            let isListed = false;
            if (marketplace) {
              try {
                isListed = await marketplace.isListed(tokenId);
              } catch {
                // Marketplace might not have this function or token not listed
              }
            }

            tokens.push({
              tokenId,
              parlayId: Number(parlayId),
              isYes,
              isListed,
            });
          }
        } catch (err) {
          // Token doesn't exist or other error - continue
        }
      }

      setUserTokens(tokens);
    } catch (err) {
      console.error('Error fetching user tokens:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user tokens');
    }
  }, [account, chain]);

  // =============================================================
  //                    EFFECTS
  // =============================================================

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    fetchUserTokens();
  }, [fetchUserTokens]);

  // =============================================================
  //                    LIST POSITION
  // =============================================================

  const listPosition = useCallback(
    async (tokenId: number, price: string) => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const marketplaceAddress = CONTRACT_ADDRESSES[chain].ParlayMarketplace;

        const marketplace = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, signer);
        const tokenAddress = await marketplace.parlayToken();
        const parlayToken = new ethers.Contract(tokenAddress, PARLAY_TOKEN_ABI, signer);

        // Check if marketplace is approved
        const isApproved = await parlayToken.isApprovedForAll(account, marketplaceAddress);
        if (!isApproved) {
          // Approve marketplace
          const approveTx = await parlayToken.setApprovalForAll(marketplaceAddress, true);
          await approveTx.wait();
        }

        // List the position
        const priceWei = ethers.parseEther(price);
        const tx = await marketplace.listPosition(tokenId, priceWei);
        await tx.wait();

        // Refresh data
        await fetchListings();
        await fetchUserTokens();
      } catch (err) {
        console.error('Error listing position:', err);
        setError(err instanceof Error ? err.message : 'Failed to list position');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, chain, fetchListings, fetchUserTokens]
  );

  // =============================================================
  //                    BUY POSITION
  // =============================================================

  const buyPosition = useCallback(
    async (listingId: number) => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const marketplaceAddress = CONTRACT_ADDRESSES[chain].ParlayMarketplace;

        const marketplace = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, signer);

        // Get listing price
        const listing = await marketplace.getListing(listingId);

        // Buy the position
        const tx = await marketplace.buyPosition(listingId, { value: listing.price });
        await tx.wait();

        // Refresh data
        await fetchListings();
        await fetchUserTokens();
      } catch (err) {
        console.error('Error buying position:', err);
        setError(err instanceof Error ? err.message : 'Failed to buy position');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, chain, fetchListings, fetchUserTokens]
  );

  // =============================================================
  //                    CANCEL LISTING
  // =============================================================

  const cancelListing = useCallback(
    async (listingId: number) => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const marketplaceAddress = CONTRACT_ADDRESSES[chain].ParlayMarketplace;

        const marketplace = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, signer);

        const tx = await marketplace.cancelListing(listingId);
        await tx.wait();

        // Refresh data
        await fetchListings();
        await fetchUserTokens();
      } catch (err) {
        console.error('Error cancelling listing:', err);
        setError(err instanceof Error ? err.message : 'Failed to cancel listing');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, chain, fetchListings, fetchUserTokens]
  );

  // =============================================================
  //                    UPDATE PRICE
  // =============================================================

  const updatePrice = useCallback(
    async (listingId: number, newPrice: string) => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const marketplaceAddress = CONTRACT_ADDRESSES[chain].ParlayMarketplace;

        const marketplace = new ethers.Contract(marketplaceAddress, MARKETPLACE_ABI, signer);

        const priceWei = ethers.parseEther(newPrice);
        const tx = await marketplace.updatePrice(listingId, priceWei);
        await tx.wait();

        // Refresh data
        await fetchListings();
      } catch (err) {
        console.error('Error updating price:', err);
        setError(err instanceof Error ? err.message : 'Failed to update price');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, chain, fetchListings]
  );

  // =============================================================
  //                    RETURN
  // =============================================================

  return {
    listings,
    userTokens,
    isLoading,
    error,
    listPosition,
    buyPosition,
    cancelListing,
    updatePrice,
    refresh: useCallback(() => {
      fetchListings();
      fetchUserTokens();
    }, [fetchListings, fetchUserTokens]),
  };
}
