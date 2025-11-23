import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  createFDCAttestationRequest,
  encodeFDCRequest,
} from '@/lib/fdc-encoder';
import { FDC_CONFIGS } from '@/lib/fdc-types';

const FDC_ATTESTOR_URL = process.env.FDC_ATTESTOR_URL || 'http://localhost:8080';
const FDC_API_KEY = process.env.FDC_API_KEY || 'your-secure-api-key';

/**
 * API endpoint to request FDC attestation for Polymarket market resolution
 * POST /api/fdc/request-attestation
 * 
 * Body: { conditionIds: string[], network?: 'coston2' | 'flare' }
 * Returns: { requestId: string, status: string, votingRound: number, estimatedFinalization: number }
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

    // Validate network type
    const validNetwork: 'coston2' | 'flare' = network === 'flare' ? 'flare' : 'coston2';
    const config = FDC_CONFIGS[validNetwork];

    // Create attestation requests for each condition
    const requests = conditionIds.map((conditionId: string) => {
      const attestationRequest = createFDCAttestationRequest(conditionId);
      const encodedRequest = encodeFDCRequest(attestationRequest);
      
      return {
        conditionId,
        attestationType: 100, // APIData
        sourceId: 100, // PolymarketAPI
        requestBody: encodedRequest,
      };
    });

    // Submit to local FDC attestor REST API
    try {
      const fdcResponse = await fetch(`${FDC_ATTESTOR_URL}/fsp/prepare-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': FDC_API_KEY,
        },
        body: JSON.stringify({
          attestationType: '0x64', // 100 in hex (APIData)
          sourceId: '0x64', // 100 in hex (PolymarketAPI)
          requestBody: requests[0].requestBody,
        }),
      });

      if (!fdcResponse.ok) {
        const errorText = await fdcResponse.text();
        console.error('FDC attestor error:', errorText);
        
        return NextResponse.json({
          error: 'FDC attestor not available',
          details: errorText,
          suggestion: 'Make sure the FDC attestor is running on ' + FDC_ATTESTOR_URL,
        }, { status: 503 });
      }

      const fdcData = await fdcResponse.json();
      
      // Generate a request ID for tracking
      const requestId = ethers.keccak256(
        ethers.toUtf8Bytes(
          JSON.stringify({ conditionIds, timestamp: Date.now() })
        )
      );

    return NextResponse.json({
      success: true,
        requestId,
        status: 'pending',
      network: validNetwork,
        conditionIds,
        votingRound: fdcData.votingRound,
        estimatedFinalization: Date.now() + (config.finalizationTime * 1000),
        message: 'FDC attestation request submitted successfully',
      });

    } catch (fdcError) {
      console.error('Error connecting to FDC attestor:', fdcError);
      
      return NextResponse.json({
        error: 'Cannot connect to FDC attestor',
        details: fdcError instanceof Error ? fdcError.message : 'Unknown error',
        suggestion: `Ensure FDC attestor is running on ${FDC_ATTESTOR_URL}`,
      }, { status: 503 });
    }

  } catch (error) {
    console.error('Error requesting FDC attestation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to request attestation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
