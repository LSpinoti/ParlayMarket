/**
 * FDC Client utilities for interacting with Flare Data Connector
 * and the FlarePolymarketOracle
 */

import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from './contracts';
import { createAttestationResponse, encodePolymarketResponse } from './fdc-encoder';

export interface ResolutionData {
  conditionId: string;
  resolved: boolean;
  outcome: number; // 0=NO, 1=YES, 2=INVALID
  question?: string;
  error?: string;
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
 * Submit resolution data to oracle (testing mode - direct submission)
 * 
 * @param conditionIds Array of condition IDs to resolve
 * @param signer Ethers signer with owner permissions
 * @param network Network to use
 * @returns Transaction receipt
 */
export async function submitResolutionsToOracle(
  conditionIds: string[],
  signer: ethers.Signer,
  network: 'coston2' | 'flare' = 'coston2'
) {
  // Fetch resolution data for all conditions
  const resolutions = await Promise.all(
    conditionIds.map(id => fetchPolymarketResolution(id))
  );

  // Filter out unresolved markets
  const resolved = resolutions.filter(r => r.closed);
  
  if (resolved.length === 0) {
    throw new Error('No resolved markets to submit');
  }

  // Get oracle contract
  const oracleAddress = CONTRACT_ADDRESSES[network].FlarePolymarketOracle;
  const oracleABI = [
    'function setOutcomesBatch(bytes32[] calldata conditionIds, uint8[] calldata outcomes) external',
    'function getOutcome(bytes32 conditionId) external view returns (bool resolved, uint8 outcome)',
    'function owner() external view returns (address)',
  ];

  const oracle = new ethers.Contract(oracleAddress, oracleABI, signer);

  // Convert condition IDs to bytes32
  // ConditionIds are already hex strings, just ensure they're properly padded
  const conditionIdsBytes32 = resolved.map(r => 
    ethers.zeroPadValue(r.conditionId, 32)
  );
  const outcomes = resolved.map(r => r.outcome);

  console.log('Submitting resolutions:', {
    conditionIds: resolved.map(r => r.conditionId),
    outcomes,
  });

  // Submit batch
  const tx = await oracle.setOutcomesBatch(conditionIdsBytes32, outcomes);
  const receipt = await tx.wait();

  return {
    receipt,
    submitted: resolved.length,
    conditionIds: resolved.map(r => r.conditionId),
    outcomes,
  };
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

/**
 * Request FDC attestation (production mode)
 * 
 * Note: This is a placeholder. In production, you would:
 * 1. Submit request to FDC Hub contract
 * 2. Wait for finalization (~90 seconds)
 * 3. Retrieve attestation data and Merkle proof
 * 4. Submit to oracle with proof
 */
export async function requestFDCAttestation(
  conditionIds: string[],
  network: 'coston2' | 'flare' = 'coston2'
) {
  const response = await fetch('/api/fdc/request-attestation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conditionIds, network }),
  });

  if (!response.ok) {
    throw new Error(`FDC attestation request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Prepare oracle submission data from API
 * 
 * This fetches the Polymarket data and prepares it for oracle submission
 */
export async function prepareOracleSubmission(
  conditionIds: string[],
  network: 'coston2' | 'flare' = 'coston2'
) {
  const response = await fetch('/api/fdc/submit-to-oracle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conditionIds, network }),
  });

  if (!response.ok) {
    throw new Error(`Oracle submission preparation failed: ${response.statusText}`);
  }

  return response.json();
}
