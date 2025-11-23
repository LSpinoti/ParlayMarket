import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

/**
 * GET /api/polymarket/market/[conditionId]
 * 
 * Attempts to fetch a specific market by conditionId from Polymarket Gamma API.
 * 
 * IMPORTANT LIMITATION:
 * The Polymarket API does not support direct lookup by conditionId (bytes32 hex format).
 * The /markets/{id} endpoint expects a market slug or numeric ID, not a conditionId.
 * This endpoint will return 422 errors for most conditionIds.
 * 
 * Path parameter:
 * - conditionId: The market's condition ID (hex string) - will likely fail
 * 
 * For resolution data, use /api/polymarket/resolution instead, or set outcomes
 * directly via the FlarePolymarketOracle contract's setOutcomesBatch() function.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conditionId: string }> }
) {
  try {
    const { conditionId } = await params;

    if (!conditionId) {
      return NextResponse.json(
        { error: 'Condition ID is required' },
        { status: 400 }
      );
    }

    const url = `${GAMMA_API_BASE}/markets/${conditionId}`;
    console.log('Fetching from Polymarket:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Cache individual market data for 5 minutes
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      // Try to get the error response body
      let errorBody;
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Unable to read error response';
      }
      
      console.error('Polymarket API error:', {
        status: response.status,
        statusText: response.statusText,
        conditionId,
        url,
        errorBody,
      });
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Market not found', conditionId },
          { status: 404 }
        );
      }
      
      if (response.status === 422) {
        return NextResponse.json(
          { 
            error: 'Invalid condition ID format or market not accessible',
            conditionId,
            details: errorBody 
          },
          { status: 422 }
        );
      }
      
      throw new Error(`Polymarket API error: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('Error fetching Polymarket market:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market' },
      { status: 500 }
    );
  }
}
