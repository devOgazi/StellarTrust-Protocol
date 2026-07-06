'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { CreditScore } from '@/types';

export interface ScoreState {
  score: CreditScore | null;
  history: unknown[];
  loading: boolean;
  error: string | null;
  refresh: (address: string) => Promise<CreditScore>;
  fetchHistory: (address: string) => Promise<void>;
}

export function useCreditScore(): ScoreState {
  const [score, setScore] = useState<CreditScore | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getScore(address);
      setScore(data);
      return data;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getScoreHistory(address);
      setHistory(data.history ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { score, history, loading, error, refresh, fetchHistory };
}
