import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

/**
 * GET /api/polymarket/market/[conditionId]
 * 
 * Fetches a specific market by conditionId from Polymarket Gamma API.
 * The /markets/{conditionId} endpoint returns a single market object.
 * 
 * Path parameter:
 * - conditionId: The market's condition ID (hex string)
 * 
 * Note: This endpoint should return a Market object directly, not an Event.
 * A Market is a specific tradable question identified by its conditionId.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { conditionId: string } }
) {
  try {
    const { conditionId } = params;

    if (!conditionId) {
      return NextResponse.json(
        { error: 'Condition ID is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${GAMMA_API_BASE}/markets/${conditionId}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache individual market data for 5 minutes
        next: { revalidate: 300 }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Market not found' },
          { status: 404 }
        );
      }
      throw new Error(`Polymarket API error: ${response.statusText}`);
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
