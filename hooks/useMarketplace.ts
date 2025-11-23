'use client';

import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ABIS } from '@/lib/contracts';

export interface MarketplaceListing {
  listingId: number;
  seller: string;
  tokenId: string;
  price: string;
  isYes: boolean;
  parlayId: number;
  isActive: boolean;
}

export function useMarketplace() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getMarketplaceContract = useCallback(async (signer?: ethers.Signer) => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES.coston2.ParlayMarketplace,
      ABIS.ParlayMarketplace,
      signer || provider
    );
    return contract;
  }, []);

  const getParlayMarketContract = useCallback(async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(
      CONTRACT_ADDRESSES.coston2.ParlayMarket,
      ABIS.ParlayMarket,
      provider
    );
  }, []);

  const getTokenContract = useCallback(async (signer?: ethers.Signer) => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(
      CONTRACT_ADDRESSES.coston2.ParlayToken,
      ABIS.ParlayToken,
      signer || provider
    );
  }, []);

  const fetchAllListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const marketplace = await getMarketplaceContract();
      const parlayMarket = await getParlayMarketContract();

      const [listingIds] = await marketplace.getActiveListings(0, 100);
      
      const listings = await Promise.all(
        listingIds.map(async (id: bigint) => {
          const listing = await marketplace.listings(id);
          let parlayName = '';
          try {
            const parlay = await parlayMarket.getParlay(listing.parlayId);
            parlayName = parlay.name;
          } catch (e) {
            console.error('Error loading parlay name:', e);
          }
          
          return {
            listingId: Number(id),
            seller: listing.seller,
            tokenId: listing.tokenId.toString(),
            price: ethers.formatEther(listing.price),
            isYes: listing.isYes,
            parlayId: Number(listing.parlayId),
            isActive: listing.isActive,
            parlayName,
          };
        })
      );

      return listings;
    } catch (err: any) {
      console.error('Error fetching listings:', err);
      setError(err.message || 'Failed to fetch listings');
      return [];
    } finally {
      setLoading(false);
    }
  }, [getMarketplaceContract, getParlayMarketContract]);

  const fetchYesListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const marketplace = await getMarketplaceContract();
      const parlayMarket = await getParlayMarketContract();

      const [listingIds] = await marketplace.getYesListings(0, 100);
      
      const listings = await Promise.all(
        listingIds.map(async (id: bigint) => {
          const listing = await marketplace.listings(id);
          let parlayName = '';
          try {
            const parlay = await parlayMarket.getParlay(listing.parlayId);
            parlayName = parlay.name;
          } catch (e) {
            console.error('Error loading parlay name:', e);
          }
          
          return {
            listingId: Number(id),
            seller: listing.seller,
            tokenId: listing.tokenId.toString(),
            price: ethers.formatEther(listing.price),
            isYes: listing.isYes,
            parlayId: Number(listing.parlayId),
            isActive: listing.isActive,
            parlayName,
          };
        })
      );

      return listings;
    } catch (err: any) {
      console.error('Error fetching YES listings:', err);
      setError(err.message || 'Failed to fetch YES listings');
      return [];
    } finally {
      setLoading(false);
    }
  }, [getMarketplaceContract, getParlayMarketContract]);

  const fetchNoListings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const marketplace = await getMarketplaceContract();
      const parlayMarket = await getParlayMarketContract();

      const [listingIds] = await marketplace.getNoListings(0, 100);
      
      const listings = await Promise.all(
        listingIds.map(async (id: bigint) => {
          const listing = await marketplace.listings(id);
          let parlayName = '';
          try {
            const parlay = await parlayMarket.getParlay(listing.parlayId);
            parlayName = parlay.name;
          } catch (e) {
            console.error('Error loading parlay name:', e);
          }
          
          return {
            listingId: Number(id),
            seller: listing.seller,
            tokenId: listing.tokenId.toString(),
            price: ethers.formatEther(listing.price),
            isYes: listing.isYes,
            parlayId: Number(listing.parlayId),
            isActive: listing.isActive,
            parlayName,
          };
        })
      );

      return listings;
    } catch (err: any) {
      console.error('Error fetching NO listings:', err);
      setError(err.message || 'Failed to fetch NO listings');
      return [];
    } finally {
      setLoading(false);
    }
  }, [getMarketplaceContract, getParlayMarketContract]);

  const createListing = useCallback(async (tokenId: string, priceInFLR: string) => {
    try {
      setLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // First approve the marketplace
      const tokenContract = await getTokenContract(signer);
      const approveTx = await tokenContract.approve(
        CONTRACT_ADDRESSES.coston2.ParlayMarketplace,
        tokenId
      );
      await approveTx.wait();

      // Then create the listing
      const marketplace = await getMarketplaceContract(signer);
      const priceWei = ethers.parseEther(priceInFLR);
      const tx = await marketplace.createListing(tokenId, priceWei);
      const receipt = await tx.wait();

      return receipt;
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setError(err.message || 'Failed to create listing');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getMarketplaceContract, getTokenContract]);

  const cancelListing = useCallback(async (listingId: number) => {
    try {
      setLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplace = await getMarketplaceContract(signer);

      const tx = await marketplace.cancelListing(listingId);
      const receipt = await tx.wait();

      return receipt;
    } catch (err: any) {
      console.error('Error cancelling listing:', err);
      setError(err.message || 'Failed to cancel listing');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getMarketplaceContract]);

  const updateListingPrice = useCallback(async (listingId: number, newPriceInFLR: string) => {
    try {
      setLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplace = await getMarketplaceContract(signer);

      const priceWei = ethers.parseEther(newPriceInFLR);
      const tx = await marketplace.updateListingPrice(listingId, priceWei);
      const receipt = await tx.wait();

      return receipt;
    } catch (err: any) {
      console.error('Error updating listing price:', err);
      setError(err.message || 'Failed to update listing price');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getMarketplaceContract]);

  const purchaseListing = useCallback(async (listingId: number, priceInFLR: string) => {
    try {
      setLoading(true);
      setError(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const marketplace = await getMarketplaceContract(signer);

      const priceWei = ethers.parseEther(priceInFLR);
      const tx = await marketplace.purchaseListing(listingId, {
        value: priceWei,
      });
      const receipt = await tx.wait();

      return receipt;
    } catch (err: any) {
      console.error('Error purchasing listing:', err);
      setError(err.message || 'Failed to purchase listing');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getMarketplaceContract]);

  const fetchUserTokens = useCallback(async (account: string) => {
    try {
      setLoading(true);
      setError(null);

      const tokenContract = await getTokenContract();
      const parlayMarket = await getParlayMarketContract();
      const marketplace = await getMarketplaceContract();

      const balance = await tokenContract.balanceOf(account);
      const totalSupply = await tokenContract.totalSupply();

      const tokens = [];
      
      // In production, you'd want to use events or indexing for better performance
      for (let i = 1; i <= Math.min(Number(totalSupply), 100); i++) {
        try {
          const owner = await tokenContract.ownerOf(i);
          if (owner.toLowerCase() === account.toLowerCase()) {
            const isYes = await tokenContract.tokenSide(i);
            const parlayId = await tokenContract.tokenToParlayId(i);
            const isListed = await marketplace.isTokenListed(i);
            
            let parlayName = '';
            try {
              const parlay = await parlayMarket.getParlay(parlayId);
              parlayName = parlay.name;
            } catch (e) {
              console.error('Error loading parlay name:', e);
            }

            tokens.push({
              tokenId: i,
              isYes,
              parlayId: Number(parlayId),
              parlayName,
              isListed,
            });
          }
        } catch (e) {
          // Token doesn't exist or we don't own it
          continue;
        }
      }

      return tokens;
    } catch (err: any) {
      console.error('Error fetching user tokens:', err);
      setError(err.message || 'Failed to fetch user tokens');
      return [];
    } finally {
      setLoading(false);
    }
  }, [getTokenContract, getParlayMarketContract, getMarketplaceContract]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    clearError,
    fetchAllListings,
    fetchYesListings,
    fetchNoListings,
    createListing,
    cancelListing,
    updateListingPrice,
    purchaseListing,
    fetchUserTokens,
  };
}

