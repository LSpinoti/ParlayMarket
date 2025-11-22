import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

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
