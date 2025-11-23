/**
 * Flare Data Connector Types and Interfaces
 * 
 * Based on Flare FDC specification
 * https://dev.flare.network/fdc/overview
 */

/**
 * FDC Attestation Types
 */
export enum AttestationType {
  // Payment attestation type (e.g., Bitcoin, Dogecoin, XRPL transactions)
  Payment = 0,
  // Balance-decreasing transaction attestation
  BalanceDecreasingTransaction = 1,
  // Confirmed block height attestation
  ConfirmedBlockHeightExists = 2,
  // Referenced payment nonexistence attestation
  ReferencedPaymentNonexistence = 3,
  // Address validity attestation
  AddressValidity = 4,
  // EVM transaction attestation (for Ethereum, BSC, etc.)
  EVMTransaction = 5,
  // Generic API data attestation (for Web2 APIs like Polymarket)
  APIData = 100,
}

/**
 * Source chain identifiers for FDC
 */
export enum SourceId {
  BTC = 0,
  DOGE = 1,
  XRP = 2,
  ETH = 3,
  // Custom source for API data
  PolymarketAPI = 100,
}

/**
 * FDC Attestation Request
 */
export interface AttestationRequest {
  attestationType: AttestationType;
  sourceId: SourceId;
  requestBody: string; // ABI-encoded request data
}

/**
 * FDC Attestation Response
 */
export interface AttestationResponse {
  attestationType: AttestationType;
  sourceId: SourceId;
  votingRound: bigint;
  lowestUsedTimestamp: bigint;
  requestBody: string;
  responseBody: string; // ABI-encoded response data
}

/**
 * Merkle Proof for FDC verification
 */
export interface MerkleProof {
  merkleRoot: string;
  proof: string[]; // Array of sibling hashes
  leaf: string; // Hash of the attestation data
}

/**
 * Polymarket API attestation request data
 */
export interface PolymarketAttestationRequest {
  conditionId: string;
  apiEndpoint: string; // e.g., "https://gamma-api.polymarket.com/markets/{conditionId}"
  timestamp: bigint;
  expectedFields: string[]; // Fields to extract from API response
}

/**
 * Polymarket API attestation response data
 */
export interface PolymarketAttestationResponse {
  conditionId: string;
  closed: boolean;
  outcome: number; // 0=NO, 1=YES, 2=INVALID
  resolvedAt: bigint;
  question: string;
  apiDataHash: string; // Hash of the full API response for verification
}

/**
 * FDC Hub contract interface
 */
export const FDC_HUB_ABI = [
  "function requestAttestation(bytes calldata data) external returns (uint256 requestId)",
  "function getAttestation(uint256 requestId) external view returns (bool exists, bytes memory data)",
  "function getAttestationStatus(uint256 requestId) external view returns (uint8 status)",
  "function latestRound() external view returns (uint256)",
  "event AttestationRequest(uint256 indexed requestId, address indexed requester, bytes data)",
  "event AttestationProvided(uint256 indexed requestId, uint256 indexed votingRound)",
];

/**
 * FDC Verification contract interface (deployed by Flare)
 */
export const FDC_VERIFICATION_ABI = [
  "function verifyAttestation(bytes calldata attestationData, bytes32[] calldata merkleProof) external view returns (bool)",
  "function merkleRoot(uint256 votingRound) external view returns (bytes32)",
];

/**
 * Attestation Status
 */
export enum AttestationStatus {
  Pending = 0,
  Finalized = 1,
  Failed = 2,
}

/**
 * FDC Configuration
 */
export interface FDCConfig {
  network: 'coston2' | 'flare';
  fdcHubAddress: string;
  fdcVerificationAddress: string;
  votingRoundDuration: number; // in seconds
  finalizationTime: number; // in seconds
}

export const FDC_CONFIGS: Record<'coston2' | 'flare', FDCConfig> = {
  coston2: {
    network: 'coston2',
    // TODO: Update with actual FDC Hub address for Coston2
    fdcHubAddress: '0x0000000000000000000000000000000000000000',
    fdcVerificationAddress: '0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91',
    votingRoundDuration: 90, // 90 seconds
    finalizationTime: 90, // 90 seconds
  },
  flare: {
    network: 'flare',
    // TODO: Update with actual FDC Hub address for Flare mainnet
    fdcHubAddress: '0x0000000000000000000000000000000000000000',
    fdcVerificationAddress: '0x3A1b3220527aBA427d1e13e4b4c48c31460B4d91',
    votingRoundDuration: 90,
    finalizationTime: 90,
  },
};
