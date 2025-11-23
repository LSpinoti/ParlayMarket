import { NextRequest, NextResponse } from 'next/server';

const FDC_ATTESTOR_URL = process.env.FDC_ATTESTOR_URL || 'http://localhost:8080';
const FDC_API_KEY = process.env.FDC_API_KEY || 'your-secure-api-key';

/**
 * API endpoint to check FDC attestation status
 * GET /api/fdc/attestation-status/[requestId]
 * 
 * Returns: { status: 'pending' | 'finalized' | 'failed', votingRound?: number }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 }
      );
    }

    // Query FDC attestor for status
    try {
      const fdcResponse = await fetch(`${FDC_ATTESTOR_URL}/da/status/${requestId}`, {
        headers: {
          'X-API-KEY': FDC_API_KEY,
        },
      });

      if (!fdcResponse.ok) {
        // If not found, might still be pending
        if (fdcResponse.status === 404) {
          return NextResponse.json({
            status: 'pending',
            message: 'Attestation request not yet processed',
          });
        }

        return NextResponse.json({
          error: 'Failed to check attestation status',
          details: await fdcResponse.text(),
        }, { status: fdcResponse.status });
      }

      const data = await fdcResponse.json();

      return NextResponse.json({
        status: data.finalized ? 'finalized' : 'pending',
        votingRound: data.votingRound,
        requestId,
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
    console.error('Error checking attestation status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
