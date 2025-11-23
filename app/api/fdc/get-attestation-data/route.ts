import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { createAttestationResponse } from '@/lib/fdc-encoder';

const FDC_ATTESTOR_URL = process.env.FDC_ATTESTOR_URL || 'http://localhost:8080';
const FDC_API_KEY = process.env.FDC_API_KEY || 'your-secure-api-key';
const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

/**
 * API endpoint to get finalized attestation data and Merkle proofs
 * POST /api/fdc/get-attestation-data
 * 
 * Body: { conditionIds: string[], network?: 'coston2' | 'flare' }
 * Returns: Array of { conditionId, outcome, attestationData, merkleProof }
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

    const results = [];

    for (const conditionId of conditionIds) {
      try {
        // Fetch market data from Polymarket API
        const marketResponse = await fetch(`${GAMMA_API_BASE}/markets/${conditionId}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (!marketResponse.ok) {
          results.push({
            conditionId,
            success: false,
            error: `Failed to fetch market data: ${marketResponse.statusText}`,
          });
          continue;
        }

        const marketData = await marketResponse.json();
        
        // Create attestation response
        const attestationResponse = createAttestationResponse(conditionId, marketData);
        
        if (!marketData.closed) {
          results.push({
            conditionId,
            success: false,
            error: 'Market not closed yet',
          });
          continue;
        }

        // Try to get attestation proof from FDC
        try {
          const fdcResponse = await fetch(
            `${FDC_ATTESTOR_URL}/da/proof/${conditionId}`,
            {
              headers: {
                'X-API-KEY': FDC_API_KEY,
              },
            }
          );

          let merkleProof: string[] = [];
          let attestationData = '';

          if (fdcResponse.ok) {
            const proofData = await fdcResponse.json();
            merkleProof = proofData.proof || [];
            attestationData = proofData.attestationData || '';
          } else {
            console.warn(`No FDC proof available for ${conditionId}, using mock proof`);
            // Generate mock attestation data for local testing
            const abiCoder = ethers.AbiCoder.defaultAbiCoder();
            attestationData = abiCoder.encode(
              ['bytes32', 'bool', 'uint8', 'uint256', 'string', 'bytes32'],
              [
                ethers.zeroPadValue(conditionId, 32),
                attestationResponse.closed,
                attestationResponse.outcome,
                attestationResponse.resolvedAt,
                attestationResponse.question,
                attestationResponse.apiDataHash,
              ]
            );
            // Empty proof for local testing
            merkleProof = [];
          }

          results.push({
            conditionId,
            outcome: attestationResponse.outcome,
            attestationData,
            merkleProof,
            success: true,
          });

        } catch (fdcError) {
          console.error(`FDC error for ${conditionId}:`, fdcError);
          
          // Fallback: create attestation data without FDC proof
          const abiCoder = ethers.AbiCoder.defaultAbiCoder();
          const attestationData = abiCoder.encode(
            ['bytes32', 'bool', 'uint8', 'uint256', 'string', 'bytes32'],
            [
              ethers.zeroPadValue(conditionId, 32),
              attestationResponse.closed,
              attestationResponse.outcome,
              attestationResponse.resolvedAt,
              attestationResponse.question,
              attestationResponse.apiDataHash,
            ]
          );

          results.push({
            conditionId,
            outcome: attestationResponse.outcome,
            attestationData,
            merkleProof: [],
            success: true,
            warning: 'FDC proof not available, using fallback',
          });
        }

      } catch (error) {
        results.push({
          conditionId,
          success: false,
          error: `Failed to process: ${error instanceof Error ? error.message : 'Unknown'}`,
        });
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error getting attestation data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get attestation data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
