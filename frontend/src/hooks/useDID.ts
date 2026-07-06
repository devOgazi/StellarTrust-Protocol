'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { DIDDocument } from '@/types';

export interface DIDState {
  did: DIDDocument | null;
  loading: boolean;
  error: string | null;
  createDID: (address: string, publicKeyHex?: string) => Promise<DIDDocument>;
  resolveDID: (address: string) => Promise<DIDDocument>;
}

export function useDID(): DIDState {
  const [did, setDid] = useState<DIDDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDID = useCallback(async (address: string, publicKeyHex?: string) => {
    setLoading(true);
    setError(null);
    try {
      const doc = await apiClient.createDID(address, publicKeyHex);
      setDid(doc);
      return doc;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveDID = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const doc = await apiClient.resolveDID(address);
      setDid(doc);
      return doc;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { did, loading, error, createDID, resolveDID };
}
