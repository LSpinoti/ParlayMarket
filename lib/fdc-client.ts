/**
 * FDC Client utilities for interacting with Flare Data Connector
 * and the FlarePolymarketOracle
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from './contracts';

export interface ResolutionData {
  conditionId: string;
  resolved: boolean;
  outcome: number; // 0=NO, 1=YES, 2=INVALID
  question?: string;
  error?: string;
}

export interface FDCAttestationRequest {
  requestId: string;
  status: 'pending' | 'finalized' | 'failed';
  success?: boolean;
  votingRound?: number;
  estimatedFinalization?: number;
  message?: string;
}

export interface FDCAttestationData {
  attestationData: string; // ABI-encoded attestation
  merkleProof: string[];   // Merkle proof for verification
  outcome: number;
  conditionId: string;
}

/**
 * Fetch Polymarket market resolution data using the batch resolution endpoint
 */
export async function fetchPolymarketResolution(conditionId: string): Promise<ResolutionData> {
  try {
    // Use the resolution API endpoint which handles batch resolution lookups
    const response = await fetch('/api/polymarket/resolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditionIds: [conditionId] }),
    });

    if (!response.ok) {
      return {
        conditionId,
        resolved: false,
        outcome: 2,
        error: `Resolution API error: ${response.statusText}`,
      };
    }

    const data = await response.json();
    
    // Extract the resolution for this specific conditionId
    const resolution = data.resolutions?.find((r: any) => r.conditionId === conditionId);
    
    if (!resolution) {
      return {
        conditionId,
        resolved: false,
        outcome: 2,
        error: 'Market resolution data not found',
      };
    }

    return {
      conditionId: resolution.conditionId,
      resolved: resolution.resolved || false,
      outcome: resolution.outcome || 2,
      question: resolution.question,
      error: resolution.error,
    };
  } catch (error) {
    console.error('Error fetching market resolution:', error);
    return {
      conditionId,
      resolved: false,
      outcome: 2,
      error: `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * Request FDC attestation for condition IDs
 * Submits attestation requests to local FDC attestor
 * Returns success: false if FDC attestor is not available (graceful fallback)
 */
export async function requestFDCAttestation(
  conditionIds: string[],
  network: 'coston2' | 'flare' = 'coston2'
): Promise<FDCAttestationRequest> {
  try {
    const response = await fetch('/api/fdc/request-attestation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditionIds, network }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      
      // If FDC attestor not available, return failed status for graceful fallback
      if (response.status === 503) {
        return {
          requestId: '',
          status: 'failed',
          success: false,
          message: 'FDC attestor not available - using fallback mode',
        } as any;
      }
      
      throw new Error(`FDC attestation request failed: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return { ...data, success: true };
  } catch (error) {
    // Network error or FDC not reachable - return failed status
    console.log('FDC attestation request error:', error);
    return {
      requestId: '',
      status: 'failed',
      success: false,
      message: 'FDC attestor not reachable - using fallback mode',
    } as any;
  }
}

/**
 * Poll FDC attestation status until finalized or timeout
 */
export async function waitForFDCFinalization(
  requestId: string,
  timeoutMs: number = 120000 // 2 minutes
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(`/api/fdc/attestation-status/${requestId}`);
    
    if (!response.ok) {
      console.warn('Failed to check attestation status:', response.statusText);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      continue;
    }

    const data = await response.json();
    
    if (data.status === 'finalized') {
      return true;
    } else if (data.status === 'failed') {
      throw new Error('FDC attestation failed');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('FDC attestation timeout');
}

/**
 * Get finalized attestation data and proofs from FDC
 */
export async function getFDCAttestationData(
  conditionIds: string[],
  network: 'coston2' | 'flare' = 'coston2'
): Promise<FDCAttestationData[]> {
  const response = await fetch('/api/fdc/get-attestation-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conditionIds, network }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Failed to get attestation data: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Submit FDC-verified outcomes to oracle
 * This uses the submitOutcome() function with attestation proof
 */
export async function submitFDCVerifiedOutcomes(
  attestationData: FDCAttestationData[],
  signer: ethers.Signer,
  network: 'coston2' | 'flare' = 'coston2'
) {
  const oracleAddress = CONTRACT_ADDRESSES[network].FlarePolymarketOracle;
  const oracleABI = [
    'function submitOutcome(bytes32 conditionId, uint8 outcome, bytes calldata attestationData, bytes32[] calldata merkleProof) external',
    'function getOutcome(bytes32 conditionId) external view returns (bool resolved, uint8 outcome)',
  ];

  const oracle = new ethers.Contract(oracleAddress, oracleABI, signer);

  const results = [];

  for (const data of attestationData) {
    try {
      const conditionIdBytes32 = ethers.zeroPadValue(data.conditionId, 32);

      console.log('Submitting FDC-verified outcome:', {
        conditionId: data.conditionId,
        outcome: data.outcome,
  });

      const tx = await oracle.submitOutcome(
        conditionIdBytes32,
        data.outcome,
        data.attestationData,
        data.merkleProof
      );
      
  const receipt = await tx.wait();

      results.push({
        conditionId: data.conditionId,
        outcome: data.outcome,
        success: true,
        txHash: receipt.hash,
      });
    } catch (error) {
      console.error(`Failed to submit outcome for ${data.conditionId}:`, error);
      results.push({
        conditionId: data.conditionId,
        outcome: data.outcome,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Check if oracle has resolutions for given condition IDs
 * 
 * @param conditionIds Array of condition IDs to check
 * @param provider Ethers provider
 * @param network Network to use
 * @returns Map of condition ID to resolution status
 */
export async function checkOracleResolutions(
  conditionIds: string[],
  provider: ethers.Provider,
  network: 'coston2' | 'flare' = 'coston2'
): Promise<Map<string, { resolved: boolean; outcome: number }>> {
  const oracleAddress = CONTRACT_ADDRESSES[network].FlarePolymarketOracle;
  const oracleABI = [
    'function getOutcome(bytes32 conditionId) external view returns (bool resolved, uint8 outcome)',
  ];

  const oracle = new ethers.Contract(oracleAddress, oracleABI, provider);
  
  const results = new Map<string, { resolved: boolean; outcome: number }>();
  
  await Promise.all(
    conditionIds.map(async (conditionId) => {
      try {
        // ConditionId is already a hex string, just ensure it's properly padded to bytes32
        const conditionIdBytes32 = ethers.zeroPadValue(conditionId, 32);
        const [resolved, outcome] = await oracle.getOutcome(conditionIdBytes32);
        results.set(conditionId, { resolved, outcome: Number(outcome) });
      } catch (error) {
        console.error(`Error checking resolution for ${conditionId}:`, error);
        results.set(conditionId, { resolved: false, outcome: 2 });
      }
    })
  );

  return results;
}

