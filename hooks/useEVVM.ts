'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getProvider } from '../lib/web3';
import { CONTRACT_ADDRESSES, ChainName } from '../lib/contracts';
import {
  EVVMClient,
  VirtualBalance,
  VirtualBet,
  BetLeg,
  getEVVMHubContract,
  getVirtualBalanceFromContract,
  getUserBetsFromContract,
  getBetFromContract,
  depositToVirtual,
  withdrawFromVirtual,
  formatVirtualBalance,
  createDeadline,
} from '../lib/evvm';
import { FTSOClient, FTSOPrice } from '../lib/ftso';

// =============================================================
//                          TYPES
// =============================================================

interface UseEVVMReturn {
  // State
  virtualBalance: VirtualBalance | null;
  formattedBalance: { total: string; available: string; locked: string } | null;
  userBets: VirtualBet[];
  isLoading: boolean;
  error: string | null;

  // Actions
  deposit: (amount: string) => Promise<void>;
  withdraw: (amount: string) => Promise<void>;
  placeBet: (legs: BetLeg[], amount: string, expiry: number) => Promise<string>;
  placeDarkPoolBet: (legs: BetLeg[], amount: string, expiry: number) => Promise<string>;
  refresh: () => Promise<void>;

  // FTSO
  getPrice: (symbol: string) => Promise<FTSOPrice | null>;
  getPrices: (symbols: string[]) => Promise<FTSOPrice[]>;
}

// =============================================================
//                          HOOK
// =============================================================

export function useEVVM(
  account: string | null,
  chain: ChainName = 'coston2'
): UseEVVMReturn {
  const [virtualBalance, setVirtualBalance] = useState<VirtualBalance | null>(null);
  const [userBets, setUserBets] = useState<VirtualBet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =============================================================
  //                    FETCH DATA
  // =============================================================

  const fetchData = useCallback(async () => {
    if (!account) {
      setVirtualBalance(null);
      setUserBets([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = await getProvider();
      const evvmAddress = CONTRACT_ADDRESSES[chain].EVVM_Hub;

      if (evvmAddress === '0x0000000000000000000000000000000000000000') {
        // Contract not deployed yet
        setError('EVVM contracts not deployed');
        setIsLoading(false);
        return;
      }

      const contract = getEVVMHubContract(evvmAddress, provider);

      // Fetch virtual balance
      const balance = await getVirtualBalanceFromContract(contract, account);
      setVirtualBalance(balance);

      // Fetch user bets
      const betIds = await getUserBetsFromContract(contract, account);
      const bets = await Promise.all(
        betIds.map((id) => getBetFromContract(contract, id))
      );
      setUserBets(bets);
    } catch (err) {
      console.error('Error fetching EVVM data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [account, chain]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // =============================================================
  //                    DEPOSIT
  // =============================================================

  const deposit = useCallback(
    async (amount: string) => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const evvmAddress = CONTRACT_ADDRESSES[chain].EVVM_Hub;
        const contract = getEVVMHubContract(evvmAddress, signer);

        const tx = await depositToVirtual(contract, amount);
        await tx.wait();

        // Refresh balance
        await fetchData();
      } catch (err) {
        console.error('Deposit error:', err);
        setError(err instanceof Error ? err.message : 'Deposit failed');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, chain, fetchData]
  );

  // =============================================================
  //                    WITHDRAW
  // =============================================================

  const withdraw = useCallback(
    async (amount: string) => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        const provider = await getProvider();
        const signer = await provider.getSigner();
        const evvmAddress = CONTRACT_ADDRESSES[chain].EVVM_Hub;
        const contract = getEVVMHubContract(evvmAddress, signer);

        const tx = await withdrawFromVirtual(contract, amount);
        await tx.wait();

        // Refresh balance
        await fetchData();
      } catch (err) {
        console.error('Withdraw error:', err);
        setError(err instanceof Error ? err.message : 'Withdrawal failed');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, chain, fetchData]
  );

  // =============================================================
  //                    PLACE BET (RAPID FIRE)
  // =============================================================

  const placeBet = useCallback(
    async (legs: BetLeg[], amount: string, expiry: number): Promise<string> => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        const provider = await getProvider();
        const chainId = (await provider.getNetwork()).chainId;
        const evvmAddress = CONTRACT_ADDRESSES[chain].EVVM_Hub;

        // Create EVVM client
        const evvmClient = new EVVMClient(
          provider,
          Number(chainId),
          evvmAddress
        );

        // Get next nonce
        const nonce = await evvmClient.getNextNonce(account);

        // Create intent
        const intent = {
          bettor: account,
          legs,
          amount: ethers.parseEther(amount).toString(),
          expiry,
          nonce,
          deadline: createDeadline(300), // 5 minute deadline
        };

        // Sign intent
        const signature = await evvmClient.signBetIntent(intent);

        // Submit to relayer
        const result = await evvmClient.submitBetIntent(intent, signature);

        if (result.error) {
          throw new Error(result.error);
        }

        // Refresh data
        await fetchData();

        return result.intentId || 'bet-submitted';
      } catch (err) {
        console.error('Place bet error:', err);
        setError(err instanceof Error ? err.message : 'Failed to place bet');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, chain, fetchData]
  );

  // =============================================================
  //                    DARK POOL BET
  // =============================================================

  const placeDarkPoolBet = useCallback(
    async (legs: BetLeg[], amount: string, expiry: number): Promise<string> => {
      if (!account) throw new Error('No account connected');

      setIsLoading(true);
      setError(null);

      try {
        // Import encryption utilities
        const { createDarkPoolCommitment, DarkPoolClient } = await import(
          '../lib/encryption'
        );
        const { RELAYER_URL } = await import('../lib/evvm');

        // Create commitment
        const betData = {
          bettor: account,
          ftsoSymbols: legs.map((l) => l.symbol),
          targetPrices: legs.map((l) => l.targetPrice),
          overUnder: legs.map((l) => l.isOver),
          expiry,
        };

        const commitmentData = createDarkPoolCommitment(betData);

        // Submit commit to relayer
        const darkPoolClient = new DarkPoolClient(RELAYER_URL);
        const commitResult = await darkPoolClient.submitCommit(
          commitmentData.commitmentId,
          commitmentData.commitment,
          ethers.parseEther(amount).toString(),
          '' // Would need signature for real implementation
        );

        if (commitResult.error) {
          throw new Error(commitResult.error);
        }

        // Store commitment locally for later reveal
        // In production, this would be stored encrypted
        console.log('Commitment stored:', commitmentData.commitmentId);

        // Refresh data
        await fetchData();

        return commitmentData.commitmentId;
      } catch (err) {
        console.error('Dark pool bet error:', err);
        setError(err instanceof Error ? err.message : 'Failed to place dark pool bet');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [account, fetchData]
  );

  // =============================================================
  //                    FTSO PRICE DATA
  // =============================================================

  const getPrice = useCallback(
    async (symbol: string): Promise<FTSOPrice | null> => {
      try {
        const provider = await getProvider();
        const ftsoClient = new FTSOClient(provider, chain);
        return await ftsoClient.getCurrentPrice(symbol);
      } catch (err) {
        console.error('Get price error:', err);
        return null;
      }
    },
    [chain]
  );

  const getPrices = useCallback(
    async (symbols: string[]): Promise<FTSOPrice[]> => {
      try {
        const provider = await getProvider();
        const ftsoClient = new FTSOClient(provider, chain);
        return await ftsoClient.getMultiplePrices(symbols);
      } catch (err) {
        console.error('Get prices error:', err);
        return [];
      }
    },
    [chain]
  );

  // =============================================================
  //                    FORMATTED BALANCE
  // =============================================================

  const formattedBalance = virtualBalance
    ? formatVirtualBalance(virtualBalance)
    : null;

  return {
    virtualBalance,
    formattedBalance,
    userBets,
    isLoading,
    error,
    deposit,
    withdraw,
    placeBet,
    placeDarkPoolBet,
    refresh: fetchData,
    getPrice,
    getPrices,
  };
}
