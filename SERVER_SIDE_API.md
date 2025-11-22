# Server-Side Polymarket API Implementation

## Overview

All Polymarket API calls have been moved to the server-side using Next.js API routes. This provides better security, performance, and caching capabilities.

## Architecture

```
Client (Browser)
    ↓
/lib/polymarket.ts (Client utilities)
    ↓
/app/api/polymarket/* (Next.js API Routes)
    ↓
Polymarket Gamma API (External)
```

## API Routes Created

### 1. `/app/api/polymarket/markets/route.ts`
**Purpose**: Fetch markets with filtering options

**Endpoint**: `GET /api/polymarket/markets`

**Query Parameters**:
- `limit` - Number of markets (default: 20)
- `offset` - Pagination offset (default: 0)
- `active` - Filter active markets (true/false)
- `closed` - Filter closed markets (true/false)
- `archived` - Filter archived markets (true/false)

**Features**:
- Server-side caching (30 seconds revalidation)
- Cache-Control headers for CDN/browser caching
- Error handling with 500 status on failure

**Example Usage**:
```javascript
const markets = await fetch('/api/polymarket/markets?active=true&limit=50');
```

---

### 2. `/app/api/polymarket/search/route.ts`
**Purpose**: Search markets by keyword

**Endpoint**: `GET /api/polymarket/search`

**Query Parameters**:
- `q` - Search query (required)
- `limit` - Number of results (default: 50)

**Features**:
- Server-side caching (60 seconds revalidation)
- Query validation (returns 400 if missing)
- Cache-Control headers for optimal caching

**Example Usage**:
```javascript
const results = await fetch('/api/polymarket/search?q=Bitcoin&limit=20');
```

---

### 3. `/app/api/polymarket/market/[conditionId]/route.ts`
**Purpose**: Fetch specific market by condition ID

**Endpoint**: `GET /api/polymarket/market/:conditionId`

**Path Parameters**:
- `conditionId` - The market's condition ID

**Features**:
- Server-side caching (5 minutes revalidation)
- 404 handling for non-existent markets
- Long cache duration for stable market data

**Example Usage**:
```javascript
const market = await fetch('/api/polymarket/market/0x1234...');
```

## Caching Strategy

### Why Caching?
- Reduces load on Polymarket's API
- Improves response times for users
- Prevents rate limiting issues
- Better cost efficiency

### Caching Levels

1. **Next.js Server Cache** (`next: { revalidate: X }`)
   - Markets list: 30 seconds
   - Search results: 60 seconds
   - Individual market: 5 minutes

2. **HTTP Cache-Control Headers**
   - Public caching enabled
   - `stale-while-revalidate` for graceful updates
   - Browser and CDN caching support

### Cache Examples

```typescript
// Server-side cache (Next.js)
next: { revalidate: 30 }

// Client-side cache (HTTP headers)
'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
```

## Client-Side Changes

### Before (Direct API Calls)
```typescript
const response = await fetch(
  `https://gamma-api.polymarket.com/markets?limit=50`,
  { headers: { 'Accept': 'application/json' } }
);
```

### After (Server API Routes)
```typescript
const response = await fetch(
  `/api/polymarket/markets?limit=50`,
  { headers: { 'Accept': 'application/json' } }
);
```

## Benefits

### Security
✅ API keys managed server-side (if needed in future)
✅ Rate limiting centralized on server
✅ No client-side exposure of API endpoints
✅ CORS issues eliminated

### Performance
✅ Server-side caching reduces API calls
✅ Response times improved with cache hits
✅ CDN-compatible with Cache-Control headers
✅ Stale-while-revalidate for optimal UX

### Maintainability
✅ Centralized API logic
✅ Easier to add monitoring/logging
✅ Error handling in one place
✅ Future API changes isolated to server routes

### Development
✅ Better debugging capabilities
✅ Server-side logging available
✅ Can add request validation easily
✅ Testing isolation improved

## Error Handling

All routes implement consistent error handling:

```typescript
try {
  // API call logic
} catch (error) {
  console.error('Error message:', error);
  return NextResponse.json(
    { error: 'User-friendly message' },
    { status: 500 }
  );
}
```

## Testing the Implementation

### Test Markets Endpoint
```bash
curl http://localhost:3000/api/polymarket/markets?limit=5
```

### Test Search Endpoint
```bash
curl "http://localhost:3000/api/polymarket/search?q=Bitcoin"
```

### Test Market Detail Endpoint
```bash
curl http://localhost:3000/api/polymarket/market/{conditionId}
```

## Monitoring & Debugging

### Server Logs
All errors are logged server-side with `console.error()`:
- Failed API calls
- Invalid requests
- Network errors

### Response Status Codes
- `200` - Success
- `400` - Bad request (missing parameters)
- `404` - Market not found
- `500` - Server/API error

## Future Enhancements

Potential improvements:
- [ ] Add Redis/Memcached for distributed caching
- [ ] Implement rate limiting with `express-rate-limit` or similar
- [ ] Add request logging middleware
- [ ] Implement circuit breaker pattern
- [ ] Add health check endpoint
- [ ] Monitor API usage metrics
- [ ] Add API key support if Polymarket requires it
- [ ] Implement webhook for market updates

## Migration Checklist

✅ Created three API route files
✅ Updated client utilities to use new routes
✅ Implemented caching strategies
✅ Added error handling
✅ Updated documentation
✅ No breaking changes to client code

## Related Files

- `/app/api/polymarket/markets/route.ts` - Markets endpoint
- `/app/api/polymarket/search/route.ts` - Search endpoint
- `/app/api/polymarket/market/[conditionId]/route.ts` - Detail endpoint
- `/lib/polymarket.ts` - Client utilities (updated)
- `/app/create/page.tsx` - Uses the API (no changes needed)

## Notes

- All routes use Next.js 13+ App Router conventions
- TypeScript types preserved from client code
- No changes required to React components
- Backward compatible with existing functionality
