/**
 * FDC Request/Response Encoding Utilities
 * 
 * Encodes Polymarket API requests and responses for FDC attestation
 */

import { ethers } from 'ethers';
import {
  AttestationType,
  SourceId,
  AttestationRequest,
  AttestationResponse,
  PolymarketAttestationRequest,
  PolymarketAttestationResponse,
} from './fdc-types';

/**
 * Encode Polymarket API attestation request for FDC
 */
export function encodePolymarketRequest(
  conditionId: string,
  timestamp?: bigint
): string {
  const request: PolymarketAttestationRequest = {
    conditionId,
    apiEndpoint: `https://gamma-api.polymarket.com/markets/${conditionId}`,
    timestamp: timestamp || BigInt(Math.floor(Date.now() / 1000)),
    expectedFields: ['closed', 'tokens', 'question', 'endDateIso'],
  };

  // ABI encode the request
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ['bytes32', 'string', 'uint256', 'string[]'],
    [
      conditionId,
      request.apiEndpoint,
      request.timestamp,
      request.expectedFields,
    ]
  );
}

/**
 * Encode Polymarket API response for FDC attestation
 */
export function encodePolymarketResponse(
  conditionId: string,
  closed: boolean,
  outcome: number,
  resolvedAt: bigint,
  question: string,
  apiDataHash: string
): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ['bytes32', 'bool', 'uint8', 'uint256', 'string', 'bytes32'],
    [conditionId, closed, outcome, resolvedAt, question, apiDataHash]
  );
}

/**
 * Decode Polymarket API attestation request
 */
export function decodePolymarketRequest(
  encodedData: string
): PolymarketAttestationRequest {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const [conditionId, apiEndpoint, timestamp, expectedFields] = abiCoder.decode(
    ['bytes32', 'string', 'uint256', 'string[]'],
    encodedData
  );

  return {
    conditionId,
    apiEndpoint,
    timestamp: BigInt(timestamp),
    expectedFields,
  };
}

/**
 * Decode Polymarket API attestation response
 */
export function decodePolymarketResponse(
  encodedData: string
): PolymarketAttestationResponse {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const [conditionId, closed, outcome, resolvedAt, question, apiDataHash] =
    abiCoder.decode(
      ['bytes32', 'bool', 'uint8', 'uint256', 'string', 'bytes32'],
      encodedData
    );

  return {
    conditionId,
    closed,
    outcome: Number(outcome),
    resolvedAt: BigInt(resolvedAt),
    question,
    apiDataHash,
  };
}

/**
 * Create full FDC attestation request
 */
export function createFDCAttestationRequest(
  conditionId: string
): AttestationRequest {
  const requestBody = encodePolymarketRequest(conditionId);

  return {
    attestationType: AttestationType.APIData,
    sourceId: SourceId.PolymarketAPI,
    requestBody,
  };
}

/**
 * Encode attestation request for submission to FDC Hub
 */
export function encodeFDCRequest(request: AttestationRequest): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ['uint8', 'uint8', 'bytes'],
    [request.attestationType, request.sourceId, request.requestBody]
  );
}

/**
 * Hash API response data for verification
 */
export function hashApiResponse(responseData: any): string {
  // Create a deterministic hash of the API response
  const jsonString = JSON.stringify(responseData, Object.keys(responseData).sort());
  return ethers.keccak256(ethers.toUtf8Bytes(jsonString));
}

/**
 * Create attestation response from Polymarket API data
 */
export function createAttestationResponse(
  conditionId: string,
  marketData: any
): PolymarketAttestationResponse {
  // Determine outcome from market data
  let outcome = 2; // Default to INVALID

  if (marketData.closed && marketData.tokens && marketData.tokens.length > 0) {
    const yesToken = marketData.tokens.find(
      (t: any) => t.outcome?.toLowerCase() === 'yes'
    );
    const noToken = marketData.tokens.find(
      (t: any) => t.outcome?.toLowerCase() === 'no'
    );

    console.log('Checking tokens for winner:', {
      yesToken: yesToken ? { outcome: yesToken.outcome, winner: yesToken.winner } : null,
      noToken: noToken ? { outcome: noToken.outcome, winner: noToken.winner } : null,
    });

    if (yesToken?.winner === true) {
      outcome = 1; // YES
    } else if (noToken?.winner === true) {
      outcome = 0; // NO
    } else if (yesToken && noToken) {
      // If no explicit winner flag, check prices (winner should be at ~$1)
      const yesPrice = parseFloat(yesToken.price || '0');
      const noPrice = parseFloat(noToken.price || '0');
      
      console.log('Checking prices:', { yesPrice, noPrice });
      
      if (yesPrice > 0.95) {
        outcome = 1; // YES wins
        console.log('YES wins by price');
      } else if (noPrice > 0.95) {
        outcome = 0; // NO wins
        console.log('NO wins by price');
      }
    }
  }

  // Check explicit winning outcome
  if (outcome === 2 && marketData.winningOutcome) {
    const winningOutcome = marketData.winningOutcome.toLowerCase();
    console.log('Checking winningOutcome field:', winningOutcome);
    if (winningOutcome === 'yes') {
      outcome = 1;
    } else if (winningOutcome === 'no') {
      outcome = 0;
    }
  }

  const resolvedAt = marketData.endDateIso
    ? BigInt(Math.floor(new Date(marketData.endDateIso).getTime() / 1000))
    : BigInt(Math.floor(Date.now() / 1000));

  console.log('Final outcome determined:', outcome);

  return {
    conditionId,
    closed: marketData.closed || false,
    outcome,
    resolvedAt,
    question: marketData.question || '',
    apiDataHash: hashApiResponse(marketData),
  };
}

/**
 * Encode full attestation for oracle submission
 */
export function encodeFullAttestation(
  response: PolymarketAttestationResponse,
  votingRound: bigint
): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  const responseBody = encodePolymarketResponse(
    response.conditionId,
    response.closed,
    response.outcome,
    response.resolvedAt,
    response.question,
    response.apiDataHash
  );

  // Encode full attestation response structure
  return abiCoder.encode(
    ['uint8', 'uint8', 'uint256', 'uint256', 'bytes'],
    [
      AttestationType.APIData,
      SourceId.PolymarketAPI,
      votingRound,
      response.resolvedAt,
      responseBody,
    ]
  );
}
