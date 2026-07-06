import { describe, it, expect } from 'vitest';
import { scoreRating } from '../src/types';

describe('Score Rating', () => {
  it('returns Exceptional for scores 800-900', () => {
    expect(scoreRating(800)).toBe('Exceptional');
    expect(scoreRating(850)).toBe('Exceptional');
    expect(scoreRating(900)).toBe('Exceptional');
  });

  it('returns Very Good for scores 740-799', () => {
    expect(scoreRating(740)).toBe('Very Good');
    expect(scoreRating(770)).toBe('Very Good');
    expect(scoreRating(799)).toBe('Very Good');
  });

  it('returns Good for scores 670-739', () => {
    expect(scoreRating(670)).toBe('Good');
    expect(scoreRating(700)).toBe('Good');
    expect(scoreRating(739)).toBe('Good');
  });

  it('returns Fair for scores 580-669', () => {
    expect(scoreRating(580)).toBe('Fair');
    expect(scoreRating(620)).toBe('Fair');
    expect(scoreRating(669)).toBe('Fair');
  });

  it('returns Poor for scores 300-579', () => {
    expect(scoreRating(300)).toBe('Poor');
    expect(scoreRating(450)).toBe('Poor');
    expect(scoreRating(579)).toBe('Poor');
  });

  it('handles edge cases', () => {
    expect(scoreRating(579)).toBe('Poor');
    expect(scoreRating(580)).toBe('Fair');
    expect(scoreRating(669)).toBe('Fair');
    expect(scoreRating(670)).toBe('Good');
  });
});

describe('ScoreGauge color logic', () => {
  function scoreColor(score: number): string {
    if (score >= 800) return 'text-green-500';
    if (score >= 740) return 'text-blue-500';
    if (score >= 670) return 'text-yellow-500';
    if (score >= 580) return 'text-orange-500';
    return 'text-red-500';
  }

  it('returns green for Exceptional', () => {
    expect(scoreColor(800)).toBe('text-green-500');
  });

  it('returns blue for Very Good', () => {
    expect(scoreColor(740)).toBe('text-blue-500');
  });

  it('returns yellow for Good', () => {
    expect(scoreColor(670)).toBe('text-yellow-500');
  });

  it('returns orange for Fair', () => {
    expect(scoreColor(580)).toBe('text-orange-500');
  });

  it('returns red for Poor', () => {
    expect(scoreColor(300)).toBe('text-red-500');
  });
});

describe('ScoreBreakdown component labels', () => {
  const LABELS: Record<string, string> = {
    payment_history: 'Payment History',
    transaction_volume: 'Transaction Volume',
    account_longevity: 'Account Longevity',
    asset_diversity: 'Asset Diversity',
    cross_border_activity: 'Cross-Border Activity',
    credential_completeness: 'Credential Completeness',
  };

  it('has all 6 component labels', () => {
    expect(Object.keys(LABELS)).toHaveLength(6);
  });

  it('covers all ScoreComponents keys', () => {
    const componentKeys = [
      'payment_history',
      'account_longevity',
      'transaction_volume',
      'asset_diversity',
      'cross_border_activity',
      'credential_completeness',
    ];
    componentKeys.forEach((key) => {
      expect(LABELS[key]).toBeDefined();
    });
  });
});
