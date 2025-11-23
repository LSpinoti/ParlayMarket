/**
 * Polymarket Verifier Server for FDC Attestations
 * 
 * This server acts as the verification endpoint for the FDC client.
 * It fetches Polymarket API data and validates market resolutions.
 */

const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const API_KEY = process.env.VERIFIER_API_KEY || 'your-secure-api-key';

// Middleware to check API key
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Polymarket Verifier Server',
    timestamp: new Date().toISOString()
  });
});

/**
 * Main verification endpoint
 * Called by FDC client to verify Polymarket market resolutions
 * 
 * POST /api/verify
 * Headers: X-API-KEY: <your-api-key>
 * Body: {
 *   requestBody: string (ABI-encoded request data)
 * }
 */
app.post('/api/verify', checkApiKey, async (req, res) => {
  console.log('\n=== New Verification Request ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const { requestBody } = req.body;
    
    if (!requestBody) {
      return res.status(400).json({
        verified: false,
        error: 'Missing requestBody'
      });
    }

    // Decode the attestation request
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    let conditionId, apiEndpoint, timestamp, expectedFields;
    
    try {
      [conditionId, apiEndpoint, timestamp, expectedFields] = abiCoder.decode(
        ['bytes32', 'string', 'uint256', 'string[]'],
        requestBody
      );
    } catch (decodeError) {
      console.error('Decode error:', decodeError);
      return res.status(400).json({
        verified: false,
        error: 'Failed to decode request body'
      });
    }

    console.log('Condition ID:', conditionId);
    console.log('API Endpoint:', apiEndpoint);
    console.log('Expected Fields:', expectedFields);

    // Fetch market data from Polymarket API
    console.log('Fetching market data from Polymarket...');
    const response = await fetch(apiEndpoint, {
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'ParlayMarket-FDC-Verifier/1.0'
      }
    });

    if (!response.ok) {
      console.error('Polymarket API error:', response.statusText);
      return res.status(400).json({
        verified: false,
        error: `Polymarket API error: ${response.statusText}`
      });
    }

    const marketData = await response.json();
    console.log('Market data fetched successfully');
    console.log('Market closed:', marketData.closed);
    console.log('Market question:', marketData.question);

    // Determine outcome from market data
    let outcome = 2; // Default to INVALID
    
    if (marketData.closed && marketData.tokens && marketData.tokens.length > 0) {
      const yesToken = marketData.tokens.find(t => 
        t.outcome?.toLowerCase() === 'yes' || t.outcome?.toLowerCase() === 'true'
      );
      const noToken = marketData.tokens.find(t => 
        t.outcome?.toLowerCase() === 'no' || t.outcome?.toLowerCase() === 'false'
      );

      if (yesToken?.winner === true) {
        outcome = 1; // YES wins
        console.log('Outcome: YES (1)');
      } else if (noToken?.winner === true) {
        outcome = 0; // NO wins
        console.log('Outcome: NO (0)');
      } else {
        console.log('Outcome: INVALID/UNRESOLVED (2)');
      }
    }

    // Check explicit winning outcome field
    if (outcome === 2 && marketData.winningOutcome) {
      const winningOutcome = marketData.winningOutcome.toLowerCase();
      if (winningOutcome === 'yes' || winningOutcome === 'true') {
        outcome = 1;
        console.log('Outcome (from winningOutcome): YES (1)');
      } else if (winningOutcome === 'no' || winningOutcome === 'false') {
        outcome = 0;
        console.log('Outcome (from winningOutcome): NO (0)');
      }
    }

    // Get resolution timestamp
    const resolvedAt = marketData.endDateIso 
      ? Math.floor(new Date(marketData.endDateIso).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    // Create deterministic hash of API response
    const responseData = {
      conditionId,
      closed: marketData.closed,
      outcome,
      question: marketData.question,
      resolvedAt
    };

    const jsonString = JSON.stringify(responseData, Object.keys(responseData).sort());
    const apiDataHash = ethers.keccak256(ethers.toUtf8Bytes(jsonString));

    console.log('API Data Hash:', apiDataHash);

    // Encode the response body
    const responseBody = abiCoder.encode(
      ['bytes32', 'bool', 'uint8', 'uint256', 'string', 'bytes32'],
      [
        conditionId,
        marketData.closed || false,
        outcome,
        BigInt(resolvedAt),
        marketData.question || '',
        apiDataHash
      ]
    );

    console.log('Verification successful ✓');
    console.log('=== End Verification Request ===\n');

    // Return verification result
    res.json({
      verified: true,
      responseBody,
      metadata: {
        conditionId,
        outcome,
        closed: marketData.closed,
        question: marketData.question,
        resolvedAt,
        apiDataHash
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    console.log('=== End Verification Request (ERROR) ===\n');
    
    res.status(500).json({
      verified: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Batch verification endpoint (for efficiency)
 */
app.post('/api/verify-batch', checkApiKey, async (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'requests array is required'
      });
    }

    console.log(`\n=== Batch Verification: ${requests.length} requests ===`);

    // Process all requests in parallel
    const results = await Promise.all(
      requests.map(async (request) => {
        try {
          // Make internal call to single verification endpoint
          const response = await fetch('http://localhost:' + PORT + '/api/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': API_KEY
            },
            body: JSON.stringify({ requestBody: request.requestBody })
          });

          return await response.json();
        } catch (error) {
          return {
            verified: false,
            error: error.message
          };
        }
      })
    );

    console.log(`Batch completed: ${results.filter(r => r.verified).length}/${results.length} successful`);

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Batch verification error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Polymarket Verifier Server for FDC Attestations     ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 API Key configured: ${API_KEY !== 'your-secure-api-key' ? 'Yes ✓' : 'No ⚠️  (using default)'}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/verify        - Single verification`);
  console.log(`  POST /api/verify-batch  - Batch verification`);
  console.log(`  GET  /health            - Health check`);
  console.log('\n' + '='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
