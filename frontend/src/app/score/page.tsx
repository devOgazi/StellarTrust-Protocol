'use client';

import { useEffect } from 'react';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { useCreditScore } from '@/hooks/useCreditScore';
import { ScoreGauge, ScoreBreakdown, ScoreHistory } from '@/components/score';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { WalletConnectButton } from '@/components/wallet';
import { Input } from '@/components/ui';
import { useState } from 'react';

export default function ScorePage() {
  const { connected, address } = useStellarWallet();
  const { score, history, loading, error, refresh, fetchHistory } = useCreditScore();
  const [queryAddress, setQueryAddress] = useState('');

  const effectiveAddress = queryAddress || address || '';

  useEffect(() => {
    if (effectiveAddress) {
      refresh(effectiveAddress).catch(() => {});
      fetchHistory(effectiveAddress).catch(() => {});
    }
  }, [effectiveAddress, refresh, fetchHistory]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold">Credit Score</h1>
        <p className="text-muted-foreground">
          View your on-chain credit score and detailed breakdown.
        </p>
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Input
            placeholder="Enter Stellar address (G...)"
            value={queryAddress}
            onChange={(e) => setQueryAddress(e.target.value)}
          />
        </div>
        {!connected && !queryAddress && (
          <WalletConnectButton />
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && !score && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading score data...
          </CardContent>
        </Card>
      )}

      {score && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Score</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <ScoreGauge score={score.score} size="lg" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Data Points</span>
                  <span className="text-sm font-medium">{score.dataPoints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Last Updated</span>
                  <span className="text-sm font-medium">
                    {new Date(score.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Score Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                The 6 weighted components that make up your credit score.
              </p>
            </CardHeader>
            <CardContent>
              <ScoreBreakdown components={score.components} />
            </CardContent>
          </Card>

          <ScoreHistory history={history} loading={loading} />
        </>
      )}
    </div>
  );
}
