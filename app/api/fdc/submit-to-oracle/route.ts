import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createAttestationResponse, encodePolymarketResponse } from '@/lib/fdc-encoder';
import { CONTRACT_ADDRESSES } from '@/lib/contracts';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

/**
 * API endpoint to submit Polymarket resolution to oracle
 * This is a simplified version that:
 * 1. Fetches Polymarket API data
 * 2. Submits directly to oracle (bypassing FDC for testing)
 * 
 * POST /api/fdc/submit-to-oracle
 * Body: { conditionIds: string[], signerAddress: string, network?: 'coston2' | 'flare' }
 * 
 * Note: In production, this should:
 * 1. Wait for FDC attestation finalization
 * 2. Retrieve attestation data + Merkle proof
 * 3. Submit to oracle with proof verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conditionIds, network = 'coston2' } = body;

    if (!conditionIds || !Array.isArray(conditionIds) || conditionIds.length === 0) {
      return NextResponse.json(
        { error: 'conditionIds array is required' },
        { status: 400 }
      );
    }

    // Fetch resolution data from Polymarket API
    const resolutionPromises = conditionIds.map(async (conditionId: string) => {
      try {
        const response = await fetch(`${GAMMA_API_BASE}/markets/${conditionId}`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 10 }
        });

        if (!response.ok) {
          return {
            conditionId,
            success: false,
            error: `API error: ${response.statusText}`,
          };
        }

        const marketData = await response.json();
        
        // Create attestation response
        const attestationResponse = createAttestationResponse(conditionId, marketData);
        
        // Check if market is actually resolved
        if (!marketData.closed) {
          return {
            conditionId,
            success: false,
            error: 'Market not closed yet',
          };
        }

        // For testing: return the data that needs to be submitted
        // In production, you would submit this via wallet transaction
        return {
          conditionId,
          success: true,
          resolved: true,
          outcome: attestationResponse.outcome,
          question: attestationResponse.question,
          encodedResponse: encodePolymarketResponse(
            conditionId,
            attestationResponse.closed,
            attestationResponse.outcome,
            attestationResponse.resolvedAt,
            attestationResponse.question,
            attestationResponse.apiDataHash
          ),
        };
      } catch (error) {
        return {
          conditionId,
          success: false,
          error: `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown'}`,
        };
      }
    });

    const results = await Promise.all(resolutionPromises);
    
    // Separate successful and failed submissions
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: successful.length > 0,
      results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
      },
      oracleAddress: CONTRACT_ADDRESSES[network].FlarePolymarketOracle,
      message: 'Resolution data fetched. Submit to oracle using setOutcomesBatch() for testing, or submitOutcome() with FDC proof for production.',
      instructions: {
        testing: 'Call oracle.setOutcomesBatch(conditionIds, outcomes) as owner',
        production: 'Call oracle.submitOutcome(conditionId, outcome, attestationData, merkleProof) as attestor',
      },
    });

  } catch (error) {
    console.error('Error submitting to oracle:', error);
    return NextResponse.json(
      { 
        error: 'Failed to prepare oracle submission',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
