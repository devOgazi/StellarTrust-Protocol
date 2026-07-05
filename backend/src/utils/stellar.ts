/**
 * Stellar SDK helper utilities for StellarTrust Protocol backend.
 *
 * Provides thin wrappers around @stellar/stellar-sdk to simplify common
 * operations: Soroban RPC client creation, Horizon server access, contract
 * invocation helpers, and address validation.
 */

import {
  SorobanRpc,
  Horizon,
  StrKey,
  xdr,
  Address,
  Contract,
  scValToNative,
  nativeToScVal,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  TimeoutInfinite,
} from '@stellar/stellar-sdk';

// ---------------------------------------------------------------------------
// Environment config
// ---------------------------------------------------------------------------

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? 'testnet';
const STELLAR_RPC_URL =
  process.env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const STELLAR_HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

export const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

// ---------------------------------------------------------------------------
// Lazy-initialised singleton clients
// ---------------------------------------------------------------------------

let _rpcClient: SorobanRpc.Server | null = null;
let _horizonServer: Horizon.Server | null = null;

/**
 * Returns a singleton Soroban RPC client pointed at the configured network.
 */
export function getSorobanRpc(): SorobanRpc.Server {
  if (!_rpcClient) {
    _rpcClient = new SorobanRpc.Server(STELLAR_RPC_URL, {
      allowHttp: STELLAR_RPC_URL.startsWith('http://'),
    });
  }
  return _rpcClient;
}

/**
 * Returns a singleton Horizon server client.
 */
export function getHorizonServer(): Horizon.Server {
  if (!_horizonServer) {
    _horizonServer = new Horizon.Server(STELLAR_HORIZON_URL, {
      allowHttp: STELLAR_HORIZON_URL.startsWith('http://'),
    });
  }
  return _horizonServer;
}

// ---------------------------------------------------------------------------
// Address utilities
// ---------------------------------------------------------------------------

/**
 * Returns true if the given string is a valid Stellar public key (G...).
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Converts a Stellar G... address to the XDR ScVal format expected by
 * Soroban contract invocations.
 */
export function addressToScVal(address: string): xdr.ScVal {
  return new Address(address).toScVal();
}

/**
 * Converts a Soroban ScVal result back to its native JavaScript representation.
 */
export { scValToNative, nativeToScVal };

// ---------------------------------------------------------------------------
// DID helpers
// ---------------------------------------------------------------------------

/**
 * Derives the canonical `did:stellar:<address>` DID string from a Stellar
 * account address.
 */
export function addressToDid(address: string): string {
  return `did:stellar:${address}`;
}

/**
 * Extracts the Stellar account address from a `did:stellar:<address>` string.
 * Throws if the DID is malformed.
 */
export function didToAddress(did: string): string {
  const prefix = 'did:stellar:';
  if (!did.startsWith(prefix)) {
    throw new Error(`Invalid did:stellar DID: ${did}`);
  }
  const address = did.slice(prefix.length);
  if (!isValidStellarAddress(address)) {
    throw new Error(`DID contains invalid Stellar address: ${address}`);
  }
  return address;
}

// ---------------------------------------------------------------------------
// Contract simulation helpers
// ---------------------------------------------------------------------------

/**
 * Options for invoking a read-only (simulate) Soroban contract function.
 */
export interface SimulateOptions {
  /** Contract ID (C...) */
  contractId: string;
  /** Contract function name to call */
  method: string;
  /** ScVal arguments to pass */
  args: xdr.ScVal[];
  /** Source account for fee simulation (can be any valid G... address) */
  sourceAccount: string;
}

/**
 * Simulates a read-only Soroban contract call and returns the decoded result.
 *
 * Uses `simulateTransaction` under the hood — no ledger state changes.
 * Throws if the simulation fails or returns an error.
 */
export async function simulateContractCall<T>(
  options: SimulateOptions,
): Promise<T> {
  const rpc = getSorobanRpc();

  // Fetch source account sequence number for tx building
  const account = await rpc.getAccount(options.sourceAccount);

  const contract = new Contract(options.contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(options.method, ...options.args))
    .setTimeout(TimeoutInfinite)
    .build();

  const sim = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Contract simulation error: ${sim.error}`);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Contract simulation returned unexpected response');
  }

  const returnVal = sim.result?.retval;
  if (!returnVal) {
    throw new Error('Contract simulation returned no value');
  }

  return scValToNative(returnVal) as T;
}

// ---------------------------------------------------------------------------
// Score rating helper (shared with API layer)
// ---------------------------------------------------------------------------

/** Returns a human-readable rating for a numeric score (300–900). */
export function scoreRating(score: number): string {
  if (score >= 800) return 'Exceptional';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}
