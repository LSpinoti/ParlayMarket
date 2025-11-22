/**
 * Polymarket API integration for fetching market data
 */

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: string;
  winner?: boolean;
}

export interface PolymarketMarket {
  condition_id: string;
  question_id: string;
  question: string;
  description?: string;
  end_date_iso: string;
  game_start_time?: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  tokens: PolymarketToken[];
  markets?: Array<{
    market_slug: string;
    outcome: string;
  }>;
  category?: string;
  slug?: string;
  volume?: string;
  liquidity?: string;
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
  category?: string;
  volume?: number;
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
    return data;
  } catch (error) {
    console.error('Error fetching Polymarket markets:', error);
    return [];
  }
}

/**
 * Search markets by query string via server-side API
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
    return data;
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
  // Find YES and NO tokens
  const yesToken = market.tokens.find(t => 
    t.outcome.toLowerCase() === 'yes' || t.outcome.toLowerCase() === 'true'
  );
  const noToken = market.tokens.find(t => 
    t.outcome.toLowerCase() === 'no' || t.outcome.toLowerCase() === 'false'
  );

  return {
    id: market.question_id || market.condition_id,
    conditionId: market.condition_id,
    question: market.question,
    description: market.description || '',
    endDate: market.end_date_iso,
    yesPrice: yesToken ? parseFloat(yesToken.price) : 0.5,
    noPrice: noToken ? parseFloat(noToken.price) : 0.5,
    isActive: market.active && market.accepting_orders && !market.closed,
    category: market.category,
    volume: market.volume ? parseFloat(market.volume) : undefined,
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

    // Filter for binary markets (Yes/No) and simplify
    return markets
      .filter(market => {
        // Only include binary markets with Yes/No tokens
        if (market.tokens.length !== 2) return false;
        
        const hasYes = market.tokens.some(t => 
          t.outcome.toLowerCase() === 'yes' || t.outcome.toLowerCase() === 'true'
        );
        const hasNo = market.tokens.some(t => 
          t.outcome.toLowerCase() === 'no' || t.outcome.toLowerCase() === 'false'
        );
        
        return hasYes && hasNo;
      })
      .map(simplifyMarket);
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
