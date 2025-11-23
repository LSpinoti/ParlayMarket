import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  createFDCAttestationRequest,
  encodeFDCRequest,
} from '@/lib/fdc-encoder';
import { FDC_CONFIGS } from '@/lib/fdc-types';

/**
 * API endpoint to request FDC attestation for Polymarket market resolution
 * POST /api/fdc/request-attestation
 * 
 * Body: { conditionIds: string[], network?: 'coston2' | 'flare' }
 * Returns: { requestId: string, votingRound: number, estimatedFinalization: number }
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

    const config = FDC_CONFIGS[network];
    
    // Check if FDC Hub is configured
    if (config.fdcHubAddress === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json(
        { 
          error: 'FDC Hub not configured for this network',
          suggestion: 'Use direct oracle submission for testing, or configure FDC Hub address'
        },
        { status: 503 }
      );
    }

    // Create attestation requests for each condition
    const requests = conditionIds.map((conditionId: string) => {
      const attestationRequest = createFDCAttestationRequest(conditionId);
      const encodedRequest = encodeFDCRequest(attestationRequest);
      
      return {
        conditionId,
        attestationRequest: encodedRequest,
      };
    });

    // In production, you would submit these to the FDC Hub contract
    // For now, we'll return the prepared requests
    
    // Get provider for the Flare network
    const rpcUrl = network === 'coston2' 
      ? process.env.COSTON2_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc'
      : process.env.FLARE_RPC_URL || 'https://flare-api.flare.network/ext/C/rpc';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Get current voting round (simplified - in production, query from FDC Hub)
    const currentBlock = await provider.getBlockNumber();
    const votingRound = Math.floor(currentBlock / 10); // Rough estimate
    
    const estimatedFinalization = Date.now() + (config.finalizationTime * 1000);

    return NextResponse.json({
      success: true,
      network,
      requests: requests.map(r => r.conditionId),
      votingRound,
      estimatedFinalization,
      message: 'Attestation requests prepared. In production, these would be submitted to FDC Hub.',
      nextStep: 'For testing, use direct oracle submission. For production, submit requests to FDC Hub and wait for finalization.',
    });

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
