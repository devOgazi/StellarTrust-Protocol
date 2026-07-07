'use client';

import { useState } from 'react';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { useDID } from '@/hooks/useDID';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { WalletConnectButton } from '@/components/wallet';
import { addressToDid } from '@/lib/stellar';
import Link from 'next/link';

export default function IdentityCreatePage() {
  const { connected, address } = useStellarWallet();
  const { did, loading, error, createDID } = useDID();
  const [created, setCreated] = useState(false);

  const handleCreate = async () => {
    if (!address) return;
    try {
      await createDID(address);
      setCreated(true);
    } catch {
      // error set by hook
    }
  };

  if (created && did) {
    return (
      <div className="max-w-xl mx-auto py-12 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identity Created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-secondary p-4">
              <p className="text-sm font-mono break-all">{did.id}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Your decentralized identifier has been created and anchored to the Stellar
              network. You can now add credentials and build your credit profile.
            </p>
            <div className="flex gap-4">
              <Link href="/identity/manage">
                <Button>Manage Credentials</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!connected || !address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <h1 className="text-3xl font-bold">Create Identity</h1>
        <p className="text-muted-foreground">
          Connect your Freighter wallet to create a decentralized identity.
        </p>
        <WalletConnectButton />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Your Decentralized Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your Stellar address will be used to create a <strong>did:stellar</strong>{' '}
              identifier. This DID is self-sovereign — only you control it.
            </p>
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-sm font-mono break-all">{addressToDid(address)}</p>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create DID'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
