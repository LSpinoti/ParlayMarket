import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = searchParams.get('limit') || '50';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${GAMMA_API_BASE}/markets?_q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache search results for 60 seconds
        next: { revalidate: 60 }
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error('Error searching Polymarket markets:', error);
    return NextResponse.json(
      { error: 'Failed to search markets' },
      { status: 500 }
    );
  }
}
