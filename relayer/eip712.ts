import { ethers } from 'ethers';

/**
 * EIP-712 typed data utilities for EVVM intents
 */

export interface TypedDataDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface TypedDataField {
  name: string;
  type: string;
}

export interface TypedDataTypes {
  [key: string]: TypedDataField[];
}

export interface EIP712TypedData {
  types: TypedDataTypes;
  primaryType: string;
  domain: TypedDataDomain;
  message: Record<string, unknown>;
}

/**
 * Create EIP-712 typed data structure
 */
export function createEIP712TypedData(
  name: string,
  version: string,
  chainId: number,
  verifyingContract: string,
  types: TypedDataTypes,
  primaryType: string,
  message: Record<string, unknown>
): EIP712TypedData {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...types,
    },
    primaryType,
    domain: {
      name,
      version,
      chainId,
      verifyingContract,
    },
    message,
  };
}

/**
 * Verify EIP-712 signature
 */
export function verifySignature(
  typedData: EIP712TypedData,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const { domain, types, message } = typedData;

    // Remove EIP712Domain from types for signing
    const signTypes = { ...types };
    delete signTypes['EIP712Domain'];

    const recoveredAddress = ethers.verifyTypedData(
      domain,
      signTypes,
      message,
      signature
    );

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Hash typed data for signing
 */
export function hashTypedData(typedData: EIP712TypedData): string {
  const { domain, types, message } = typedData;

  const signTypes = { ...types };
  delete signTypes['EIP712Domain'];

  return ethers.TypedDataEncoder.hash(domain, signTypes, message);
}

/**
 * Create bet intent typed data
 */
export function createBetIntentTypedData(
  chainId: number,
  verifyingContract: string,
  bettor: string,
  amount: string,
  nonce: number,
  deadline: number,
  betDataHash: string
): EIP712TypedData {
  return createEIP712TypedData(
    'FlareBet Pro',
    '1',
    chainId,
    verifyingContract,
    {
      BetIntent: [
        { name: 'bettor', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'encryptedData', type: 'bytes32' },
      ],
    },
    'BetIntent',
    {
      bettor,
      amount,
      nonce,
      deadline,
      encryptedData: betDataHash,
    }
  );
}

/**
 * Create withdrawal intent typed data
 */
export function createWithdrawalTypedData(
  chainId: number,
  verifyingContract: string,
  user: string,
  amount: string,
  nonce: number
): EIP712TypedData {
  return createEIP712TypedData(
    'FlareBet Pro',
    '1',
    chainId,
    verifyingContract,
    {
      Withdrawal: [
        { name: 'user', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    'Withdrawal',
    {
      user,
      amount,
      nonce,
    }
  );
}
