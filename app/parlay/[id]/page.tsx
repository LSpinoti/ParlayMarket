'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useParlay } from '@/hooks/useParlays';
import { useWeb3 } from '@/hooks/useWeb3';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getParlayStatusString, getOutcomeString, CONTRACT_ADDRESSES } from '@/lib/contracts';
import { formatEther, parseEther, getParlayMarketContract, importNFTToMetamask, getParlayTokenIds, getTokenIdsFromReceipt } from '@/lib/web3';

export default function ParlayDetailPage() {
  const params = useParams();
  const router = useRouter();
  const parlayId = parseInt(params.id as string);
  const { parlay, isLoading, error, refresh } = useParlay(parlayId, 'coston2');
  const { account, isConnected, connect } = useWeb3();

  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  if (error || !parlay) {
    return (
      <div className="text-center py-16">
        <div className="text-red-500 text-xl">{error || 'Parlay not found'}</div>
      </div>
    );
  }

  const status = getParlayStatusString(parlay.status);
  const totalPayout = parlay.makerStake + parlay.takerStake;
  const isExpired = parlay.expiry * 1000 < Date.now();
  const isMaker = account?.toLowerCase() === parlay.maker.toLowerCase();
  const isTaker = account?.toLowerCase() === parlay.taker.toLowerCase();

  console.log("parlay + status", parlay, status);
  
  // Determine the display status text
  const displayStatus = status === 'Created' 
    ? `Waiting for ${parlay.makerIsYes ? 'NO' : 'YES'} taker`
    : status;

  const handleFill = async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    setActionError(null);
    setIsProcessing(true);

    try {
      const contract = await getParlayMarketContract('coston2');
      const tx = await contract.fillParlay(parlayId, {
        value: parlay.takerStake,
      });
      const receipt = await tx.wait();
      
      // Extract token IDs directly from the transaction receipt (instant, no block search!)
      let tokenIds = await getTokenIdsFromReceipt(receipt, contract);
      
      // Fallback to contract read if receipt parsing fails
      if (!tokenIds.yesTokenId || !tokenIds.noTokenId) {
        tokenIds = await getParlayTokenIds(parlayId, 'coston2');
      }
      
      // Prompt Metamask to import the NFT for the taker
      if (tokenIds.yesTokenId || tokenIds.noTokenId) {
        const tokenAddress = CONTRACT_ADDRESSES.coston2.ParlayToken;
        
        // Taker gets the opposite side of maker
        const takerTokenId = parlay.makerIsYes ? tokenIds.noTokenId : tokenIds.yesTokenId;
        
        if (takerTokenId) {
          setTimeout(async () => {
            const imported = await importNFTToMetamask(tokenAddress, takerTokenId);
            if (imported) {
              console.log('NFT imported to Metamask successfully');
            }
          }, 1000); // Small delay to let the transaction complete
        }
      }
      
      await refresh();
    } catch (err: any) {
      console.error('Error filling parlay:', err);
      setActionError(err.message || 'Failed to fill parlay');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    setIsProcessing(true);

    try {
      const contract = await getParlayMarketContract('coston2');
      const tx = await contract.cancelParlay(parlayId);
      await tx.wait();
      router.push('/my-parlays');
    } catch (err: any) {
      console.error('Error cancelling parlay:', err);
      setActionError(err.message || 'Failed to cancel parlay');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolve = async () => {
    setActionError(null);
    setIsProcessing(true);

    try {
      const contract = await getParlayMarketContract('coston2');
      const tx = await contract.resolveParlay(parlayId);
      await tx.wait();
      await refresh();
    } catch (err: any) {
      console.error('Error resolving parlay:', err);
      setActionError(err.message || 'Failed to resolve parlay');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportNFT = async (tokenId: string) => {
    try {
      const tokenAddress = CONTRACT_ADDRESSES.coston2.ParlayToken;
      const imported = await importNFTToMetamask(tokenAddress, tokenId);
      if (imported) {
        alert('NFT import request sent to Metamask!');
      } else {
        alert('NFT import was cancelled or failed');
      }
    } catch (err: any) {
      console.error('Error importing NFT:', err);
      setActionError(err.message || 'Failed to import NFT');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {parlay.name || `Parlay #${parlay.id}`}
            </h1>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold inline-block ${
              status === 'Created' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
              status === 'Filled' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
              status === 'Resolved' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
              'bg-gray-500/10 text-gray-500 border border-gray-500/20'
            }`}>
              {displayStatus}
            </span>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-sm">Total Pot</div>
            <div className="text-3xl font-bold">{formatEther(totalPayout)} FLR</div>
          </div>
        </div>

        {actionError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
            {actionError}
          </div>
        )}

        {/* Participants */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="text-gray-400 text-sm mb-1">Maker {parlay.makerIsYes ? '(YES)' : '(NO)'}</div>
            <div className="font-mono text-sm">{parlay.maker}</div>
            <div className="text-lg font-bold mt-2">{formatEther(parlay.makerStake)} FLR</div>
          </div>

          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
            <div className="text-gray-400 text-sm mb-1">Taker {parlay.makerIsYes ? '(NO)' : '(YES)'}</div>
            <div className="font-mono text-sm">
              {parlay.taker === '0x0000000000000000000000000000000000000000' ? 'Waiting...' : parlay.taker}
            </div>
            <div className="text-lg font-bold mt-2">{formatEther(parlay.takerStake)} FLR</div>
          </div>
        </div>

        {/* Market Legs */}
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">Market Legs ({parlay.conditionIds?.length || 0})</h2>
          <div className="space-y-3">
            {parlay.conditionIds?.map((conditionId, idx) => {
              const imageUrl = parlay.imageUrls?.[idx];
              const legName = parlay.legNames?.[idx] || '';
              return (
                <div key={idx} className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div className="flex gap-4 items-start">
                    {imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={imageUrl}
                          alt={`Market leg ${idx + 1}`}
                          className="w-20 h-20 rounded-lg object-cover bg-gray-700 border border-gray-600"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 flex justify-between items-start">
                      <div>
                        <div className="text-gray-400 text-sm">Leg {idx + 1}</div>
                        {legName && (
                          <div className="text-white font-semibold mt-1">{legName}</div>
                        )}
                        <div className="font-mono text-xs mt-1 text-gray-500">{conditionId}</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        parlay.requiredOutcomes?.[idx] === 1
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}>
                        Required: {getOutcomeString(parlay.requiredOutcomes?.[idx] || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expiry Info */}
        {status === 'Created' && (
          <div className="p-4 bg-gray-900/50 border border-gray-700 rounded-lg mb-6">
            <div className="text-gray-400 text-sm">Expires</div>
            <div className={`text-lg font-semibold ${isExpired ? 'text-red-500' : 'text-white'}`}>
              {new Date(parlay.expiry * 1000).toLocaleString()}
              {isExpired && ' (Expired)'}
            </div>
          </div>
        )}

        {/* NFT Token IDs */}
        {(status === 'Filled' || status === 'Resolved') && (parlay.yesTokenId || parlay.noTokenId) && (
          <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span>🎫</span> NFT Position Tokens
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {parlay.yesTokenId && (
                <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div className="text-gray-400 text-sm mb-1">YES Token ID</div>
                  <div className="font-mono text-lg font-bold text-green-400 mb-2">#{parlay.yesTokenId}</div>
                  {account?.toLowerCase() === (parlay.makerIsYes ? parlay.maker : parlay.taker).toLowerCase() && (
                    <button
                      onClick={() => handleImportNFT(parlay.yesTokenId!)}
                      className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Import to Metamask
                    </button>
                  )}
                </div>
              )}
              {parlay.noTokenId && (
                <div className="p-3 bg-gray-900/50 border border-gray-700 rounded-lg">
                  <div className="text-gray-400 text-sm mb-1">NO Token ID</div>
                  <div className="font-mono text-lg font-bold text-red-400 mb-2">#{parlay.noTokenId}</div>
                  {account?.toLowerCase() === (parlay.makerIsYes ? parlay.taker : parlay.maker).toLowerCase() && (
                    <button
                      onClick={() => handleImportNFT(parlay.noTokenId!)}
                      className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Import to Metamask
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-gray-400">
              💡 Tip: Click "Import to Metamask" to add your NFT position to your wallet
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {status === 'Created' && !isMaker && (
            <button
              onClick={handleFill}
              disabled={isProcessing}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold transition-colors"
            >
              {isProcessing ? 'Processing...' : `Fill Parlay (${formatEther(parlay.takerStake)} FLR)`}
            </button>
          )}

          {status === 'Created' && isMaker && (
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-bold transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Cancel Parlay'}
            </button>
          )}

          {status === 'Filled' && (
            <button
              onClick={handleResolve}
              disabled={isProcessing}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-bold transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Resolve Parlay'}
            </button>
          )}

          {status === 'Resolved' && (
            <div className="flex-1 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <div className="text-green-500 font-bold">Parlay Resolved ✓</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

