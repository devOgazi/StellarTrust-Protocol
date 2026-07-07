'use client';

import { useStellarWallet } from '@/hooks/useStellarWallet';
import { useDID } from '@/hooks/useDID';
import { useCreditScore } from '@/hooks/useCreditScore';
import { ScoreGauge } from '@/components/score';
import { CredentialList } from '@/components/identity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { WalletConnectButton } from '@/components/wallet';
import { addressToDid } from '@/lib/stellar';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { connected, address } = useStellarWallet();
  const { did, loading: didLoading, resolveDID } = useDID();
  const { score, loading: scoreLoading, refresh } = useCreditScore();

  useEffect(() => {
    if (address) {
      resolveDID(address).catch(() => {});
      refresh(address).catch(() => {});
    }
  }, [address, resolveDID, refresh]);

  if (!connected || !address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Connect your wallet to view your dashboard.</p>
        <WalletConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {did?.id ?? addressToDid(address)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Credit Score</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {scoreLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : score ? (
              <ScoreGauge score={score.score} size="lg" />
            ) : (
              <p className="text-muted-foreground">No score data yet.</p>
            )}
          </CardContent>
        </Card>

        <CredentialList
          credentials={did?.credentials ?? []}
          loading={didLoading}
        />
      </div>
    </div>
  );
}
