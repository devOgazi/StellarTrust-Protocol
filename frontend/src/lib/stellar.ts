import {
  isConnected,
  getPublicKey,
  signTransaction,
  signBlob,
} from '@stellar/freighter-api';
import {
  Keypair,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Asset,
  Memo,
} from '@stellar/stellar-sdk';

export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
export const STELLAR_HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

export const networkPassphrase =
  STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

export async function freighterIsConnected(): Promise<boolean> {
  try {
    return await isConnected();
  } catch {
    return false;
  }
}

export async function freighterGetAddress(): Promise<string | null> {
  try {
    return await getPublicKey();
  } catch {
    return null;
  }
}

export async function freighterSignTransaction(
  txXdr: string,
): Promise<string> {
  return signTransaction(txXdr);
}

export async function freighterSignBlob(
  blob: string,
): Promise<string> {
  return signBlob(blob);
}

export function addressToDid(address: string): string {
  return `did:stellar:${address}`;
}

export function isValidStellarAddress(address: string): boolean {
  try {
    Keypair.fromPublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export function shortenAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
