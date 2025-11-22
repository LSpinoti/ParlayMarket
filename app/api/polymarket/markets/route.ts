import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';
    const active = searchParams.get('active');
    const closed = searchParams.get('closed');
    const archived = searchParams.get('archived');

    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit);
    queryParams.append('offset', offset);
    
    if (active !== null) {
      queryParams.append('active', active);
    }
    if (closed !== null) {
      queryParams.append('closed', closed);
    }
    if (archived !== null) {
      queryParams.append('archived', archived);
    }

    const response = await fetch(
      `${GAMMA_API_BASE}/markets?${queryParams.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache for 30 seconds to reduce API calls
        next: { revalidate: 30 }
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Error fetching Polymarket markets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
