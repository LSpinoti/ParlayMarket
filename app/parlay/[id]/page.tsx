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
  const userSide = isMaker 
    ? (parlay.makerIsYes ? 'YES' : 'NO')
    : isTaker 
    ? (parlay.makerIsYes ? 'NO' : 'YES')
    : null;

  console.log("parlay + status", parlay, status);
  
  // Determine the display status text
  let displayStatus = status === 'Created' 
    ? `Waiting for ${parlay.makerIsYes ? 'NO' : 'YES'} taker`
    : status;
  
  // Show resolution outcome for resolved parlays
  if (status === 'Resolved' && parlay.yesWins !== null && parlay.yesWins !== undefined) {
    displayStatus = `Resolved to ${parlay.yesWins ? 'YES' : 'NO'}`;
  }

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

  const handleDirectResolve = async (yesWins: boolean) => {
    setActionError(null);
    setIsProcessing(true);

    try {
      console.log(`Directly resolving parlay to ${yesWins ? 'YES' : 'NO'}...`);
      
      const contract = await getParlayMarketContract('coston2');
      const tx = await contract.directResolve(parlayId, yesWins);
      await tx.wait();
      
      console.log('Parlay resolved successfully!');
      setActionError(null);
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-neutral-400 hover:text-white bg-white/5 backdrop-blur-xl border border-white/10 rounded-full transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/10 hover:border-white/20"
        >
          ← Back
        </button>
      </div>

      <div className="p-8 bg-neutral-800/50 border border-neutral-700 rounded-xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {parlay.name || `Parlay #${parlay.id}`}
            </h1>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold inline-block backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] ${
              status === 'Created' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
              status === 'Filled' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
              status === 'Resolved' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
              'bg-neutral-500/10 text-neutral-500 border border-neutral-500/20'
            }`}>
              {displayStatus}
            </span>
          </div>
          <div className="text-right">
            <div className="text-neutral-400 text-sm">Total Pot</div>
            <div className="text-3xl font-bold">{formatEther(totalPayout)} FLR</div>
          </div>
        </div>

        {actionError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 mb-6">
            {actionError}
          </div>
        )}

        {/* User Position Indicator */}
        {(isMaker || isTaker) && userSide && (
          <div className="p-4 bg-blue-500/10 border border-white/20 rounded-lg mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-neutral-300 text-sm mb-1">Your Position</div>
                <div className="text-lg font-semibold text-white">
                  You are on the <span className={`font-bold ${
                    userSide === 'YES' ? 'text-green-400' : 'text-red-400'
                  }`}>{userSide}</span> side
                  {isMaker && <span className="text-neutral-400 text-sm ml-2">(Maker)</span>}
                  {isTaker && <span className="text-neutral-400 text-sm ml-2">(Taker)</span>}
                </div>
              </div>
              <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                userSide === 'YES' 
                  ? 'bg-green-500/20 text-green-400 border border-white/20' 
                  : 'bg-red-500/20 text-red-400 border border-white/20'
              }`}>
                {userSide}
              </div>
            </div>
          </div>
        )}

        {/* Participants */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-lg border ${
            isMaker 
              ? 'bg-blue-500/10 border-white/20 ring-2 ring-blue-500/20' 
              : 'bg-neutral-900/50 border-neutral-700'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-neutral-400 text-sm">Maker {parlay.makerIsYes ? '(YES)' : '(NO)'}</div>
              {isMaker && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-white/20">
                  You
                </span>
              )}
            </div>
            <div className="font-mono text-sm">{parlay.maker}</div>
            <div className="text-lg font-bold mt-2">{formatEther(parlay.makerStake)} FLR</div>
          </div>

          <div className={`p-4 rounded-lg border ${
            isTaker 
              ? 'bg-blue-500/10 border-white/20 ring-2 ring-blue-500/20' 
              : 'bg-neutral-900/50 border-neutral-700'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-neutral-400 text-sm">Taker {parlay.makerIsYes ? '(NO)' : '(YES)'}</div>
              {isTaker && (
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-white/20">
                  You
                </span>
              )}
            </div>
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
                <div key={idx} className="p-4 bg-neutral-900/50 border border-neutral-700 rounded-lg">
                  <div className="flex gap-4 items-start">
                    {imageUrl && (
                      <div className="flex-shrink-0">
                        <img
                          src={imageUrl}
                          alt={`Market leg ${idx + 1}`}
                          className="w-20 h-20 rounded-lg object-cover bg-neutral-700 border border-neutral-600"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 flex justify-between items-start">
                      <div>
                        <div className="text-neutral-400 text-sm">Leg {idx + 1}</div>
                        {legName && (
                          <div className="text-white font-semibold mt-1">{legName}</div>
                        )}
                        <div className="font-mono text-xs mt-1 text-neutral-500">{conditionId}</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-semibold backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] border ${
                        parlay.requiredOutcomes?.[idx] === 1
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
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
          <div className="p-4 bg-neutral-900/50 border border-neutral-700 rounded-lg mb-6">
            <div className="text-neutral-400 text-sm">Expires</div>
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
                <div className="p-3 bg-neutral-900/50 border border-neutral-700 rounded-lg">
                  <div className="text-neutral-400 text-sm mb-1">YES Token ID</div>
                  <div className="font-mono text-lg font-bold text-green-400 mb-2">#{parlay.yesTokenId}</div>
                  {account?.toLowerCase() === (parlay.makerIsYes ? parlay.maker : parlay.taker).toLowerCase() && (
                    <button
                      onClick={() => handleImportNFT(parlay.yesTokenId!)}
                      className="w-full py-2 px-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-sm font-semibold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/20 hover:border-white/30"
                    >
                      Import to Metamask
                    </button>
                  )}
                </div>
              )}
              {parlay.noTokenId && (
                <div className="p-3 bg-neutral-900/50 border border-neutral-700 rounded-lg">
                  <div className="text-neutral-400 text-sm mb-1">NO Token ID</div>
                  <div className="font-mono text-lg font-bold text-red-400 mb-2">#{parlay.noTokenId}</div>
                  {account?.toLowerCase() === (parlay.makerIsYes ? parlay.taker : parlay.maker).toLowerCase() && (
                    <button
                      onClick={() => handleImportNFT(parlay.noTokenId!)}
                      className="w-full py-2 px-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full text-sm font-semibold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/20 hover:border-white/30"
                    >
                      Import to Metamask
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-neutral-400">
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
              className="flex-1 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full font-bold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/20 hover:border-white/30 disabled:bg-neutral-600/20 disabled:border-neutral-600/30 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : `Fill Parlay (${formatEther(parlay.takerStake)} FLR)`}
            </button>
          )}

          {status === 'Created' && isMaker && (
            <button
              onClick={handleCancel}
              disabled={isProcessing}
              className="flex-1 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full font-bold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/20 hover:border-white/30 disabled:bg-neutral-600/20 disabled:border-neutral-600/30 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Cancel Parlay'}
            </button>
          )}

          {status === 'Filled' && (
            <button
              onClick={(e) => {
                // Check if click was on the text element
                const target = e.target as HTMLElement;
                if (target.tagName === 'SPAN') {
                  // Clicked on text = YES
                  handleDirectResolve(true);
                } else {
                  // Clicked on button but not text = NO
                  handleDirectResolve(false);
                }
              }}
              disabled={isProcessing}
              className="flex-1 py-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full font-bold transition-all shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-white/20 hover:border-white/30 disabled:bg-neutral-600/20 disabled:border-neutral-600/30 disabled:opacity-50"
              title="Click text for YES, click button padding for NO"
            >
              <span className="pointer-events-auto">
                {isProcessing ? 'Processing...' : 'Resolve Parlay'}
              </span>
            </button>
          )}

          {status === 'Resolved' && (
            <div className="flex-1 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <div className="text-green-500 font-bold">
                {parlay.yesWins !== null && parlay.yesWins !== undefined 
                  ? `Resolved to ${parlay.yesWins ? 'YES' : 'NO'} ✓`
                  : 'Parlay Resolved ✓'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

