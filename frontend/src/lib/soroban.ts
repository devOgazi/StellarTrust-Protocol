import { Asset } from '@stellar/stellar-sdk';
import {
  STELLAR_NETWORK,
  networkPassphrase,
} from './stellar';

export const IDENTITY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_IDENTITY_CONTRACT_ID ?? '';
export const SCORE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_SCORE_CONTRACT_ID ?? '';
export const REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID ?? '';

export interface SorobanInvocation {
  contractId: string;
  method: string;
  args: unknown[];
  source?: string;
}

export function buildSorobanInvocation(
  contractId: string,
  method: string,
  args: unknown[] = [],
): SorobanInvocation {
  return { contractId, method, args };
}

export async function simulateContract(
  invocation: SorobanInvocation,
): Promise<unknown> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
  const res = await fetch(`${apiUrl}/contract/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractId: invocation.contractId,
      method: invocation.method,
      args: invocation.args,
      network: STELLAR_NETWORK,
    }),
  });
  if (!res.ok) {
    throw new Error(`Contract simulation failed: ${res.status}`);
  }
  return res.json();
}
