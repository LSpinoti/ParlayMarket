# Polymarket Verifier Server

This server acts as the verification endpoint for the Flare Data Connector (FDC) client. It fetches and validates Polymarket market resolution data.

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set a secure VERIFIER_API_KEY

# Start the server
npm start

# Or run in development mode with auto-reload
npm run dev
```

## Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "Polymarket Verifier Server",
  "timestamp": "2025-11-23T10:00:00.000Z"
}
```

### `POST /api/verify`
Main verification endpoint called by FDC client.

**Headers:**
- `X-API-KEY`: Your configured API key
- `Content-Type`: application/json

**Request Body:**
```json
{
  "requestBody": "0x..." // ABI-encoded attestation request
}
```

**Response:**
```json
{
  "verified": true,
  "responseBody": "0x...", // ABI-encoded attestation response
  "metadata": {
    "conditionId": "0xabc123...",
    "outcome": 1,
    "closed": true,
    "question": "Will X happen?",
    "resolvedAt": 1700000000,
    "apiDataHash": "0x..."
  }
}
```

### `POST /api/verify-batch`
Batch verification for multiple markets.

**Headers:**
- `X-API-KEY`: Your configured API key
- `Content-Type`: application/json

**Request Body:**
```json
{
  "requests": [
    { "requestBody": "0x..." },
    { "requestBody": "0x..." }
  ]
}
```

## Configuration

Edit `.env` file:

```env
# Server port
PORT=3001

# API key for authentication (change this!)
VERIFIER_API_KEY=your-secure-random-key
```

## Integration with FDC Client

In your FDC client configuration (`userConfig.toml`):

```toml
[verifiers.PolymarketAPI.Sources.PolymarketGamma]
url = "http://localhost:3001/api/verify"
api_key = "your-secure-random-key"  # Must match VERIFIER_API_KEY
lut_limit = "86400"
queue = "polymarket_queue"
```

## Development

```bash
# Run with auto-reload
npm run dev

# Test the server
curl http://localhost:3001/health
```

## Production Deployment

1. **Set secure API key** in `.env`
2. **Use process manager** like PM2:
   ```bash
   npm install -g pm2
   pm2 start index.js --name polymarket-verifier
   pm2 save
   pm2 startup
   ```
3. **Configure reverse proxy** (nginx/caddy) with HTTPS
4. **Set up monitoring** and alerts
5. **Configure firewall** to only allow FDC client access

## Security Notes

- Always use HTTPS in production
- Keep API key secret and rotate regularly
- Implement rate limiting for public deployments
- Monitor for suspicious activity
- Consider IP whitelisting for FDC client

## Monitoring

The server logs all verification requests with:
- Timestamp
- Condition ID
- API endpoint called
- Outcome determined
- Success/failure status

Set up log aggregation and alerting for:
- Failed verifications
- Polymarket API errors
- Unusual activity patterns

## Troubleshooting

### "Unauthorized" error
- Check API key in FDC config matches `.env`
- Ensure `X-API-KEY` header is set correctly

### "Polymarket API error"
- Check Polymarket API is accessible
- Verify condition ID is correct
- Check network connectivity

### "Failed to decode request body"
- Ensure FDC client is sending correct ABI-encoded data
- Check ABI configuration matches

## License

MIT
