'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  freighterIsConnected,
  freighterGetAddress,
} from '@/lib/stellar';

export interface WalletState {
  connected: boolean;
  address: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useStellarWallet(): WalletState {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const isConn = await freighterIsConnected();
      if (isConn) {
        const addr = await freighterGetAddress();
        if (addr) {
          setConnected(true);
          setAddress(addr);
        }
      }
    };
    check();
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const addr = await freighterGetAddress();
      if (!addr) {
        throw new Error('No address returned from Freighter. Is the extension installed?');
      }
      setConnected(true);
      setAddress(addr);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
    setError(null);
  }, []);

  return { connected, address, connecting, error, connect, disconnect };
}
