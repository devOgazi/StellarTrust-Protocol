'use client';

import { Progress } from '@/components/ui';
import type { ScoreComponents } from '@/types';

interface ScoreBreakdownProps {
  components: ScoreComponents;
}

const COMPONENT_LABELS: Record<keyof ScoreComponents, string> = {
  paymentHistory: 'Payment History',
  transactionVolume: 'Transaction Volume',
  accountLongevity: 'Account Longevity',
  assetDiversity: 'Asset Diversity',
  crossBorderActivity: 'Cross-Border Activity',
  credentialCompleteness: 'Credential Completeness',
};

const COMPONENT_WEIGHTS: Record<keyof ScoreComponents, number> = {
  paymentHistory: 35,
  transactionVolume: 20,
  accountLongevity: 15,
  assetDiversity: 10,
  crossBorderActivity: 10,
  credentialCompleteness: 10,
};

function componentVariant(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 700) return 'success';
  if (value >= 500) return 'warning';
  return 'danger';
}

export function ScoreBreakdown({ components }: ScoreBreakdownProps) {
  const keys = Object.keys(COMPONENT_LABELS) as (keyof ScoreComponents)[];

  return (
    <div className="space-y-4">
      {keys.map((key) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{COMPONENT_LABELS[key]}</span>
            <span className="text-sm text-muted-foreground">
              {components[key]} / 1000 &middot; {COMPONENT_WEIGHTS[key]}%
            </span>
          </div>
          <Progress
            value={components[key]}
            max={1000}
            variant={componentVariant(components[key])}
          />
        </div>
      ))}
    </div>
  );
}
