'use client';

import { useState, useEffect, useCallback } from 'react';
import { getParlayMarketContract, getParlayTokenIds } from '@/lib/web3';
import { ParlayData, ChainName } from '@/lib/contracts';

export function useParlays(chain: ChainName = 'coston2') {
  const [parlays, setParlays] = useState<ParlayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParlays = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const contract = await getParlayMarketContract(chain);
      const totalParlays = await contract.getTotalParlays();
      const total = Number(totalParlays);

      const parlayPromises: Promise<ParlayData>[] = [];
      for (let i = 0; i < total; i++) {
        parlayPromises.push(
          contract.getParlay(i).then((data: any) => ({
            id: i,
            maker: data.maker,
            taker: data.taker,
            conditionIds: data.conditionIds || [],
            requiredOutcomes: data.requiredOutcomes?.map((x: any) => Number(x)) || [],
            makerStake: data.makerStake,
            takerStake: data.takerStake,
            expiry: Number(data.expiry),
            status: Number(data.status),
            makerIsYes: data.makerIsYes,
          }))
        );
      }

      const loadedParlays = await Promise.all(parlayPromises);
      setParlays(loadedParlays);
    } catch (err: any) {
      console.error('Error fetching parlays:', err);
      setError(err.message || 'Failed to fetch parlays');
    } finally {
      setIsLoading(false);
    }
  }, [chain]);

  useEffect(() => {
    fetchParlays();
  }, [fetchParlays]);

  return {
    parlays,
    isLoading,
    error,
    refresh: fetchParlays,
  };
}

export function useParlay(parlayId: number, chain: ChainName = 'coston2') {
  const [parlay, setParlay] = useState<ParlayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParlay = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const contract = await getParlayMarketContract(chain);
      const data = await contract.getParlay(parlayId);
      
      // Fetch token IDs if parlay is filled
      let tokenIds = { yesTokenId: null, noTokenId: null };
      const status = Number(data.status);
      if (status === 1 || status === 2) { // Filled or Resolved
        tokenIds = await getParlayTokenIds(parlayId, chain);
      }
      
      setParlay({
        id: parlayId,
        maker: data.maker,
        taker: data.taker,
        conditionIds: data.conditionIds || [],
        requiredOutcomes: data.requiredOutcomes?.map((x: any) => Number(x)) || [],
        makerStake: data.makerStake,
        takerStake: data.takerStake,
        expiry: Number(data.expiry),
        status: status,
        makerIsYes: data.makerIsYes,
        yesTokenId: tokenIds.yesTokenId,
        noTokenId: tokenIds.noTokenId,
      });
    } catch (err: any) {
      console.error('Error fetching parlay:', err);
      setError(err.message || 'Failed to fetch parlay');
    } finally {
      setIsLoading(false);
    }
  }, [parlayId, chain]);

  useEffect(() => {
    fetchParlay();
  }, [fetchParlay]);

  return {
    parlay,
    isLoading,
    error,
    refresh: fetchParlay,
  };
}

