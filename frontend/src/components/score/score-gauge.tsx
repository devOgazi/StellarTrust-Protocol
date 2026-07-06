'use client';

import { scoreRating } from '@/types';

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: { container: 'w-24 h-24', text: 'text-xl', rating: 'text-xs' },
  md: { container: 'w-36 h-36', text: 'text-3xl', rating: 'text-sm' },
  lg: { container: 'w-48 h-48', text: 'text-4xl', rating: 'text-base' },
};

function scoreColor(score: number): string {
  if (score >= 800) return 'text-green-500';
  if (score >= 740) return 'text-blue-500';
  if (score >= 670) return 'text-yellow-500';
  if (score >= 580) return 'text-orange-500';
  return 'text-red-500';
}

function scoreRingColor(score: number): string {
  if (score >= 800) return 'stroke-green-500';
  if (score >= 740) return 'stroke-blue-500';
  if (score >= 670) return 'stroke-yellow-500';
  if (score >= 580) return 'stroke-orange-500';
  return 'stroke-red-500';
}

export function ScoreGauge({ score, size = 'md' }: ScoreGaugeProps) {
  const cfg = sizeConfig[size];
  const rating = scoreRating(score);
  const pct = ((score - 300) / (900 - 300)) * 100;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={`relative ${cfg.container} flex flex-col items-center justify-center`}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-secondary"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={scoreRingColor(score)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${cfg.text} font-bold ${scoreColor(score)}`}>
          {score}
        </span>
        <span className={`${cfg.rating} text-muted-foreground`}>
          {rating}
        </span>
      </div>
    </div>
  );
}
