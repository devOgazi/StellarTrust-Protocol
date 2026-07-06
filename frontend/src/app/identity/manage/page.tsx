'use client';

import { useEffect, useState, useCallback } from 'react';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { useDID } from '@/hooks/useDID';
import { CredentialList } from '@/components/identity/credential-list';
import { AddCredentialForm } from '@/components/identity/add-credential-form';
import { WalletConnectButton } from '@/components/wallet';

export default function IdentityManagePage() {
  const { connected, address } = useStellarWallet();
  const { did, loading, resolveDID } = useDID();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (address) {
      resolveDID(address).catch(() => {});
    }
  }, [address, resolveDID, refreshKey]);

  if (!connected || !address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <h1 className="text-3xl font-bold">Manage Identity</h1>
        <p className="text-muted-foreground">Connect your wallet to manage credentials.</p>
        <WalletConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold">Manage Identity</h1>
        <p className="text-muted-foreground">
          Add, view, and revoke verifiable credentials.
        </p>
      </div>

      <AddCredentialForm ownerAddress={address} onAdded={handleRefresh} />

      <CredentialList
        credentials={did?.credentials ?? []}
        loading={loading}
        onRevoked={handleRefresh}
      />
    </div>
  );
}
