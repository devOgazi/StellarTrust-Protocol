'use client';

import { Button } from '@/components/ui';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { shortenAddress } from '@/lib/stellar';

export function WalletConnectButton() {
  const { connected, address, connecting, error, connect, disconnect } =
    useStellarWallet();

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {shortenAddress(address)}
        </span>
        <Button variant="outline" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={connect} disabled={connecting}>
        {connecting ? 'Connecting...' : 'Connect Freighter'}
      </Button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
