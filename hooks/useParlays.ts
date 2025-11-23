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
      
      // Check if contract has the function (for backwards compatibility)
      let totalParlays;
      try {
        totalParlays = await contract.getTotalParlays();
      } catch (err: any) {
        if (err.code === 'BAD_DATA' || err.message?.includes('could not decode')) {
          throw new Error('Contract needs to be redeployed. The deployed contract is missing the getTotalParlays function. Please redeploy the updated contract.');
        }
        throw err;
      }
      
      const total = Number(totalParlays);

      const parlayPromises: Promise<ParlayData>[] = [];
      for (let i = 0; i < total; i++) {
        parlayPromises.push(
          contract.getParlay(i).then((data: any) => {
            // Handle both array and object return formats from ethers
            let yesTokenId: string | null = null;
            let noTokenId: string | null = null;
            
            if (Array.isArray(data)) {
              // If returned as array, token IDs are at indices 12 and 13
              yesTokenId = data[12]?.toString() || null;
              noTokenId = data[13]?.toString() || null;
            } else if (data && typeof data === 'object') {
              // If returned as object with named properties
              yesTokenId = data.yesTokenId?.toString() || null;
              noTokenId = data.noTokenId?.toString() || null;
            }
            
            return {
              id: i,
              maker: Array.isArray(data) ? data[0] : data.maker,
              taker: Array.isArray(data) ? data[1] : data.taker,
              name: (Array.isArray(data) ? data[2] : data.name) || '',
              conditionIds: (Array.isArray(data) ? data[3] : data.conditionIds) || [],
              requiredOutcomes: (Array.isArray(data) ? data[4] : data.requiredOutcomes)?.map((x: any) => Number(x)) || [],
              legNames: (Array.isArray(data) ? data[5] : data.legNames) || [],
              imageUrls: (Array.isArray(data) ? data[6] : data.imageUrls) || [],
              makerStake: Array.isArray(data) ? data[7] : data.makerStake,
              takerStake: Array.isArray(data) ? data[8] : data.takerStake,
              expiry: Number(Array.isArray(data) ? data[9] : data.expiry),
              status: Number(Array.isArray(data) ? data[10] : data.status),
              makerIsYes: Array.isArray(data) ? data[11] : data.makerIsYes,
              yesTokenId: (yesTokenId && yesTokenId !== '0') ? yesTokenId : null,
              noTokenId: (noTokenId && noTokenId !== '0') ? noTokenId : null,
            };
          })
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
      
      // Handle both array and object return formats from ethers
      let yesTokenId: string | null = null;
      let noTokenId: string | null = null;
      
      if (Array.isArray(data)) {
        // If returned as array, token IDs are at indices 12 and 13
        yesTokenId = data[12]?.toString() || null;
        noTokenId = data[13]?.toString() || null;
      } else if (data && typeof data === 'object') {
        // If returned as object with named properties
        yesTokenId = data.yesTokenId?.toString() || null;
        noTokenId = data.noTokenId?.toString() || null;
      }
      
      // Fallback to direct mapping read if getParlay doesn't return token IDs (for backwards compatibility)
      if ((!yesTokenId || yesTokenId === '0') && (!noTokenId || noTokenId === '0')) {
        const tokenIds = await getParlayTokenIds(parlayId, chain);
        yesTokenId = tokenIds.yesTokenId;
        noTokenId = tokenIds.noTokenId;
      }
      
      setParlay({
        id: parlayId,
        maker: Array.isArray(data) ? data[0] : data.maker,
        taker: Array.isArray(data) ? data[1] : data.taker,
        name: (Array.isArray(data) ? data[2] : data.name) || '',
        conditionIds: (Array.isArray(data) ? data[3] : data.conditionIds) || [],
        requiredOutcomes: (Array.isArray(data) ? data[4] : data.requiredOutcomes)?.map((x: any) => Number(x)) || [],
        legNames: (Array.isArray(data) ? data[5] : data.legNames) || [],
        imageUrls: (Array.isArray(data) ? data[6] : data.imageUrls) || [],
        makerStake: Array.isArray(data) ? data[7] : data.makerStake,
        takerStake: Array.isArray(data) ? data[8] : data.takerStake,
        expiry: Number(Array.isArray(data) ? data[9] : data.expiry),
        status: Number(Array.isArray(data) ? data[10] : data.status),
        makerIsYes: Array.isArray(data) ? data[11] : data.makerIsYes,
        yesTokenId: (yesTokenId && yesTokenId !== '0') ? yesTokenId : null,
        noTokenId: (noTokenId && noTokenId !== '0') ? noTokenId : null,
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

