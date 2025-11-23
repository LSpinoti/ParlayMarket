/**
 * Polymarket API integration for fetching market data
 */

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: string;
  winner?: boolean;
}

/**
 * Polymarket Market object from Gamma API
 * Note: A market is a specific tradable question (e.g., "Will Bitcoin hit $100k?")
 * This is different from an Event, which contains multiple related markets.
 */
export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string; // Unique identifier for the market (hex string)
  questionID?: string;
  slug?: string; // Human-readable identifier for URLs
  description?: string;
  endDate: string;
  endDateIso?: string;
  startDate?: string;
  startDateIso?: string;
  gameStartTime?: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  acceptingOrders?: boolean;
  outcomes: string; // Comma-separated string of outcomes (e.g., "Yes,No")
  outcomePrices: string; // Comma-separated string of prices (e.g., "0.45,0.55")
  category?: string;
  volume?: string;
  volumeNum?: number;
  liquidity?: string;
  liquidityNum?: number;
  image?: string;
  icon?: string;
  fee?: string;
  marketType?: string;
  clobTokenIds?: string;
  tokens?: PolymarketToken[];
  // Note: The 'markets' property should only exist on Events, not Markets.
  // This is included here for defensive programming in case the API returns an Event
  // when we expect a Market (which shouldn't happen per spec).
  markets?: Array<{
    market_slug: string;
    outcome: string;
  }>;
  // Resolution data
  resolved?: boolean;
  resolvedBy?: string;
  resolutionTime?: string;
  winningOutcome?: string;
}

export interface SimplifiedMarket {
  id: string;
  conditionId: string;
  question: string;
  description: string;
  endDate: string;
  yesPrice: number;
  noPrice: number;
  isActive: boolean;
  image?: string;
  category?: string;
  volume?: number;
  resolved?: boolean;
  winningOutcome?: number; // 0 = NO, 1 = YES, 2 = INVALID/undefined
}

/**
 * Fetch active markets from Polymarket via server-side API
 */
export async function fetchPolymarketMarkets(params?: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
}): Promise<PolymarketMarket[]> {
  try {
    const queryParams = new URLSearchParams();
    
    // Default parameters
    queryParams.append('limit', String(params?.limit || 20));
    queryParams.append('offset', String(params?.offset || 0));
    
    if (params?.active !== undefined) {
      queryParams.append('active', String(params.active));
    }
    if (params?.closed !== undefined) {
      queryParams.append('closed', String(params.closed));
    }
    if (params?.archived !== undefined) {
      queryParams.append('archived', String(params.archived));
    }

    const response = await fetch(
      `/api/polymarket/markets?${queryParams.toString()}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }

    const data = await response.json();
    
    // The /markets endpoint returns an array of market objects directly
    // Ensure we return an array even if the API wraps it
    if (Array.isArray(data)) {
      return data;
    }
    // If the API returns a wrapped object (shouldn't happen per spec, but defensive)
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data.results && Array.isArray(data.results)) {
      return data.results;
    }
    // Fallback: return empty array if structure is unexpected
    console.warn('Unexpected response structure from /markets endpoint:', data);
    return [];
  } catch (error) {
    console.error('Error fetching Polymarket markets:', error);
    return [];
  }
}

/**
 * Search markets by query string via server-side API
 * The /public-search endpoint returns events (which contain markets), tags, and profiles.
 * We need to extract markets from the events array.
 */
export async function searchPolymarketMarkets(query: string): Promise<PolymarketMarket[]> {
  try {
    const response = await fetch(
      `/api/polymarket/search?q=${encodeURIComponent(query)}&limit=50`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search markets: ${response.statusText}`);
    }

    const data = await response.json();
    
    // The /public-search endpoint returns events, which contain markets
    // Extract all markets from all events
    const markets: PolymarketMarket[] = [];
    
    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        // Events contain a markets array with the actual market objects
        if (event.markets && Array.isArray(event.markets)) {
          markets.push(...event.markets);
        }
      }
    }
    
    return markets;
  } catch (error) {
    console.error('Error searching Polymarket markets:', error);
    return [];
  }
}

/**
 * Fetch a specific market by condition ID via server-side API
 */
export async function fetchMarketByConditionId(conditionId: string): Promise<PolymarketMarket | null> {
  try {
    const response = await fetch(
      `/api/polymarket/market/${conditionId}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching market:', error);
    return null;
  }
}

/**
 * Convert Polymarket market to simplified format
 */
export function simplifyMarket(market: PolymarketMarket): SimplifiedMarket {
  // Parse outcomes and prices
  const outcomes = market.outcomes ? JSON.parse(market.outcomes) : [];
  const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [];
  
  // Find YES and NO outcomes
  const yesIndex = outcomes.findIndex((o: string) => 
    o.toLowerCase().includes('yes') || o.toLowerCase().includes('true')
  );
  const noIndex = outcomes.findIndex((o: string) => 
    o.toLowerCase().includes('no') || o.toLowerCase().includes('false')
  );

  const yesPrice = yesIndex !== -1 && prices[yesIndex] ? parseFloat(prices[yesIndex]) : 0.5;
  const noPrice = noIndex !== -1 && prices[noIndex] ? parseFloat(prices[noIndex]) : 0.5;

  return {
    id: market.questionID || market.id,
    conditionId: market.conditionId,
    question: market.question,
    description: market.description || '',
    endDate: market.endDateIso || market.endDate,
    image: market.image,
    yesPrice,
    noPrice,
    isActive: market.active && !market.closed && (market.acceptingOrders !== false),
    category: market.category,
    volume: market.volumeNum || (market.volume ? parseFloat(market.volume) : undefined),
  };
}

/**
 * Fetch and simplify active markets
 */
export async function fetchSimplifiedMarkets(params?: {
  limit?: number;
  searchQuery?: string;
}): Promise<SimplifiedMarket[]> {
  try {
    let markets: PolymarketMarket[];
    
    if (params?.searchQuery) {
      markets = await searchPolymarketMarkets(params.searchQuery);
    } else {
      markets = await fetchPolymarketMarkets({
        limit: params?.limit || 50,
        active: true,
        closed: false,
        archived: false,
      });
    }
    console.log(markets);
    // Filter for binary markets (Yes/No) and simplify
    const ret = markets
      .filter(market => {
        // Only include binary markets with Yes/No outcomes
        const outcomes = market.outcomes ? market.outcomes.split(',') : [];
        if (outcomes.length !== 2) return false;
        
        const hasYes = outcomes.some(o => 
          o.toLowerCase().includes('yes') || o.toLowerCase().includes('true')
        );
        const hasNo = outcomes.some(o => 
          o.toLowerCase().includes('no') || o.toLowerCase().includes('false')
        );
        return hasYes && hasNo && market.conditionId;
      })
      .map(simplifyMarket);
      return ret;
  } catch (error) {
    console.error('Error fetching simplified markets:', error);
    return [];
  }
}

/**
 * Convert condition ID to bytes32 format for smart contract
 */
export function conditionIdToBytes32(conditionId: string): string {
  // If already in bytes32 format
  if (conditionId.startsWith('0x') && conditionId.length === 66) {
    return conditionId;
  }
  
  // If it's a hex string without 0x prefix
  if (/^[0-9a-fA-F]{64}$/.test(conditionId)) {
    return '0x' + conditionId;
  }
  
  // Otherwise, pad or convert as needed
  // Note: Polymarket condition IDs are typically already in the correct format
  return conditionId;
}

/**
 * Format market end date to human-readable string
 */
export function formatMarketEndDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  
  if (date < now) {
    return 'Ended';
  }
  
  const diff = date.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m`;
  }
}

/**
 * Check if a market is resolved and get the winning outcome
 * @param conditionId The condition ID of the market
 * @returns Object with resolved status and outcome (0=NO, 1=YES, 2=INVALID/undefined)
 */
export async function getMarketResolution(conditionId: string): Promise<{
  resolved: boolean;
  outcome: number; // 0 = NO, 1 = YES, 2 = INVALID
}> {
  try {
    const response = await fetch(
      `/api/polymarket/resolution?conditionIds=${encodeURIComponent(conditionId)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { resolved: false, outcome: 2 };
    }

    const data = await response.json();
    
    if (data.resolutions && data.resolutions.length > 0) {
      const resolution = data.resolutions[0];
      return {
        resolved: resolution.resolved,
        outcome: resolution.outcome,
      };
    }
    
    return { resolved: false, outcome: 2 };
  } catch (error) {
    console.error('Error checking market resolution:', error);
    return { resolved: false, outcome: 2 };
  }
}

/**
 * Batch check resolution for multiple markets
 * @param conditionIds Array of condition IDs to check
 * @returns Array of resolution data for each market
 */
export async function batchGetMarketResolutions(conditionIds: string[]): Promise<Array<{
  conditionId: string;
  resolved: boolean;
  outcome: number;
}>> {
  try {
    const response = await fetch(
      `/api/polymarket/resolution?conditionIds=${conditionIds.map(id => encodeURIComponent(id)).join(',')}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch resolutions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.resolutions || [];
  } catch (error) {
    console.error('Error batch checking market resolutions:', error);
    // Return default invalid outcomes for all markets on error
    return conditionIds.map(conditionId => ({
      conditionId,
      resolved: false,
      outcome: 2,
    }));
  }
}
