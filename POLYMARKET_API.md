# Polymarket API Integration

This document describes the Polymarket API integration for listing available markets and Yes/No bets in the Create Parlay page.

## Overview

The application now integrates with Polymarket's public API to allow users to browse and select from real prediction markets when creating parlays.

## Features

### 1. Market Browser
- **Browse Markets**: Click the "📊 Browse Markets" button on the Create Parlay page
- **Real-time Data**: Fetches live market data from Polymarket
- **Binary Markets Only**: Filters to show only Yes/No markets suitable for parlays

### 2. Search Functionality
- Search markets by keywords (e.g., "Bitcoin", "Trump", "Election")
- Press Enter or click Search to filter results
- Clear search to return to browsing all markets

### 3. Market Information Display
Each market shows:
- **Question**: The prediction market question
- **Description**: Additional context about the market
- **Category**: Market category (Politics, Crypto, Sports, etc.)
- **End Date**: Time remaining until market closes
- **Volume**: Trading volume in the market
- **Current Prices**: Yes and No prices in cents

### 4. Adding Markets to Parlay
- Click **YES** button to add the market requiring a YES outcome
- Click **NO** button to add the market requiring a NO outcome
- Market is automatically added as a new leg with:
  - Condition ID converted to bytes32 format
  - Selected outcome (Yes=1, No=0)
  - Market question as description

## API Architecture

### Server-Side Implementation
All Polymarket API calls are now made server-side through Next.js API routes. This provides:
- **Better Security**: API keys and rate limits managed server-side
- **Caching**: Server-side caching reduces API calls and improves performance
- **No CORS Issues**: Server handles external API communication
- **Better Performance**: Response caching and revalidation strategies

### API Routes

#### 1. `/api/polymarket/markets`
Fetches markets with filtering options.

**Query Parameters**:
- `limit`: Number of markets to fetch (default: 20)
- `offset`: Pagination offset (default: 0)
- `active`: Filter for active markets (true/false)
- `closed`: Filter for closed markets (true/false)
- `archived`: Filter for archived markets (true/false)

**Caching**: 30 seconds revalidation

#### 2. `/api/polymarket/search`
Search markets by query string.

**Query Parameters**:
- `q`: Search query (required)
- `limit`: Number of results (default: 50)

**Caching**: 60 seconds revalidation

#### 3. `/api/polymarket/market/[conditionId]`
Fetch specific market by condition ID.

**Path Parameter**:
- `conditionId`: The market's condition ID

**Caching**: 5 minutes revalidation

### Upstream API
Server routes proxy to Polymarket's Gamma API:
- **Base URL**: `https://gamma-api.polymarket.com`
- **Documentation**: Public API for market data

## Implementation Files

### Server-Side API Routes

#### `/app/api/polymarket/markets/route.ts`
GET endpoint for fetching markets with filtering.
- Handles query parameters
- Implements caching strategy (30s revalidation)
- Returns market data or error responses

#### `/app/api/polymarket/search/route.ts`
GET endpoint for searching markets.
- Validates search query parameter
- Implements caching strategy (60s revalidation)
- Returns filtered market results

#### `/app/api/polymarket/market/[conditionId]/route.ts`
GET endpoint for fetching specific market.
- Dynamic route with condition ID parameter
- Implements caching strategy (5min revalidation)
- Handles 404 for non-existent markets

### Client-Side Code

#### `/lib/polymarket.ts`
Core utility functions for Polymarket integration:

- `fetchPolymarketMarkets()`: Fetch markets via server API
- `searchPolymarketMarkets()`: Search markets via server API
- `fetchMarketByConditionId()`: Get specific market via server API
- `simplifyMarket()`: Convert API response to simplified format
- `fetchSimplifiedMarkets()`: Main function for fetching filtered binary markets
- `conditionIdToBytes32()`: Convert condition ID to smart contract format
- `formatMarketEndDate()`: Format end date to human-readable string

#### `/app/create/page.tsx`
Updated Create Parlay page with:
- Market browser modal UI
- Search functionality
- Market selection handlers
- Integration with existing parlay creation flow

## Data Types

### `SimplifiedMarket`
```typescript
{
  id: string;              // Market ID
  conditionId: string;      // Condition ID for smart contract
  question: string;         // Market question
  description: string;      // Market description
  endDate: string;         // ISO date string
  yesPrice: number;        // Yes price (0-1)
  noPrice: number;         // No price (0-1)
  isActive: boolean;       // Whether market is active
  category?: string;       // Market category
  volume?: number;         // Trading volume
}
```

## Usage Flow

1. User clicks "📊 Browse Markets" on Create Parlay page
2. Modal opens showing 100 most recent active binary markets
3. User can:
   - Scroll through markets
   - Search for specific topics
   - View market details and prices
4. User clicks YES or NO on a market
5. Market is added to parlay legs with:
   - Condition ID in bytes32 format
   - Required outcome set
   - Question as description
6. User can add multiple markets to build parlay
7. User continues with stake and terms as before
8. Creates parlay with selected markets

## Benefits

### User Experience
- **Better UX**: Users can browse real markets instead of manually entering IDs
- **Current Data**: Shows live prices and volumes
- **Validation**: Only binary (Yes/No) markets are shown
- **Search**: Easy to find markets on specific topics
- **Transparency**: Users see exactly what they're betting on

### Technical Benefits
- **Server-Side Caching**: Reduces API calls and improves load times
- **Better Security**: API communication handled securely on server
- **No CORS Issues**: Server-to-server communication avoids browser restrictions
- **Rate Limiting**: Server can implement rate limiting strategies
- **Error Handling**: Centralized error handling in API routes
- **Monitoring**: Easier to monitor and log API usage

## Manual Entry Option

The original manual entry option is still available:
- Click "+ Manual Entry" to add a leg with custom condition ID
- Useful for testing or advanced users with specific condition IDs

## Error Handling

- If API fails, returns empty array (graceful degradation)
- Loading states shown during fetch
- "No markets found" message for empty results
- Network errors logged to console

## Future Enhancements

Potential improvements:
- Category filtering
- Sort by volume, price, or end date
- Save favorite markets
- Display current positions/liquidity
- Show related markets
- Integration with market resolution status
