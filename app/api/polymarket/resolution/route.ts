import { NextRequest, NextResponse } from 'next/server';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';

/**
 * API endpoint to check resolution status of Polymarket markets
 * GET /api/polymarket/resolution?conditionIds=<id1>,<id2>,<id3>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conditionIdsParam = searchParams.get('conditionIds');

    if (!conditionIdsParam) {
      return NextResponse.json(
        { error: 'conditionIds parameter is required' },
        { status: 400 }
      );
    }

    // Parse comma-separated condition IDs
    const conditionIds = conditionIdsParam.split(',').map(id => id.trim()).filter(Boolean);

    if (conditionIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one condition ID is required' },
        { status: 400 }
      );
    }

    // Fetch resolution data for each market
    const resolutionPromises = conditionIds.map(async (conditionId) => {
      try {
        const response = await fetch(
          `${GAMMA_API_BASE}/markets/${conditionId}`,
          {
            headers: {
              'Accept': 'application/json',
            },
            // Cache for 30 seconds since resolution data changes infrequently
            next: { revalidate: 30 }
          }
        );

        if (!response.ok) {
          return {
            conditionId,
            resolved: false,
            outcome: 2, // INVALID
            error: `Market not found or API error: ${response.statusText}`
          };
        }

        const market = await response.json();
        
        // Check if market is closed
        if (!market.closed) {
          return {
            conditionId,
            resolved: false,
            outcome: 2, // Not resolved yet
          };
        }

        // Check tokens for winner
        let outcome = 2; // Default to INVALID
        
        if (market.tokens && market.tokens.length > 0) {
          const yesToken = market.tokens.find((t: any) => 
            t.outcome?.toLowerCase() === 'yes' || t.outcome?.toLowerCase() === 'true'
          );
          const noToken = market.tokens.find((t: any) => 
            t.outcome?.toLowerCase() === 'no' || t.outcome?.toLowerCase() === 'false'
          );
          
          if (yesToken?.winner === true) {
            outcome = 1; // YES wins
          } else if (noToken?.winner === true) {
            outcome = 0; // NO wins
          }
        }

        // Check if market has explicit winning outcome field
        if (outcome === 2 && market.winningOutcome) {
          const winningOutcome = market.winningOutcome.toLowerCase();
          if (winningOutcome === 'yes' || winningOutcome === 'true') {
            outcome = 1;
          } else if (winningOutcome === 'no' || winningOutcome === 'false') {
            outcome = 0;
          }
        }

        // Determine if resolved (closed and has a winner)
        const resolved = market.closed && outcome !== 2;

        return {
          conditionId,
          resolved,
          outcome,
          question: market.question,
          closedDate: market.endDateIso || market.endDate,
        };

      } catch (error) {
        console.error(`Error fetching market ${conditionId}:`, error);
        return {
          conditionId,
          resolved: false,
          outcome: 2,
          error: 'Failed to fetch market data'
        };
      }
    });

    const resolutions = await Promise.all(resolutionPromises);

    return NextResponse.json(
      { resolutions },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
        }
      }
    );

  } catch (error) {
    console.error('Error fetching market resolutions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market resolutions' },
      { status: 500 }
    );
  }
}
