'use client';

import { Progress } from '@/components/ui';
import type { ScoreComponents } from '@/types';

interface ScoreBreakdownProps {
  components: ScoreComponents;
}

const COMPONENT_LABELS: Record<keyof ScoreComponents, string> = {
  payment_history: 'Payment History',
  transaction_volume: 'Transaction Volume',
  account_longevity: 'Account Longevity',
  asset_diversity: 'Asset Diversity',
  cross_border_activity: 'Cross-Border Activity',
  credential_completeness: 'Credential Completeness',
};

const COMPONENT_WEIGHTS: Record<keyof ScoreComponents, number> = {
  payment_history: 35,
  transaction_volume: 20,
  account_longevity: 15,
  asset_diversity: 10,
  cross_border_activity: 10,
  credential_completeness: 10,
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
