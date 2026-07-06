'use client';

import { useCallback } from 'react';
import {
  buildSorobanInvocation,
  simulateContract,
  IDENTITY_CONTRACT_ID,
  SCORE_CONTRACT_ID,
} from '@/lib/soroban';

export interface ContractsState {
  identityContract: {
    simulateCreateDID: (owner: string) => Promise<unknown>;
    simulateAddCredential: (args: unknown[]) => Promise<unknown>;
  };
  scoreContract: {
    simulateGetScore: (subject: string) => Promise<unknown>;
  };
}

export function useContracts(): ContractsState {
  const simulateCreateDID = useCallback(async (owner: string) => {
    return simulateContract(
      buildSorobanInvocation(IDENTITY_CONTRACT_ID, 'create_did', [owner]),
    );
  }, []);

  const simulateAddCredential = useCallback(async (args: unknown[]) => {
    return simulateContract(
      buildSorobanInvocation(IDENTITY_CONTRACT_ID, 'add_credential', args),
    );
  }, []);

  const simulateGetScore = useCallback(async (subject: string) => {
    return simulateContract(
      buildSorobanInvocation(SCORE_CONTRACT_ID, 'get_score', [subject]),
    );
  }, []);

  return {
    identityContract: {
      simulateCreateDID,
      simulateAddCredential,
    },
    scoreContract: {
      simulateGetScore,
    },
  };
}
