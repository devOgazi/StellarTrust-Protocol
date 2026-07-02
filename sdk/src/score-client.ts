// Credit score query client — placeholder.
import { StellarTrustConfig, CreditScoreResult, LenderVerificationResult } from './types';

export class ScoreClient {
  constructor(private config: StellarTrustConfig) {}

  async get(_address: string): Promise<CreditScoreResult> {
    throw new Error('Not implemented');
  }

  async verify(_options: {
    address: string;
    requiredScore: number;
    requiredCredentials: string[];
  }): Promise<LenderVerificationResult> {
    throw new Error('Not implemented');
  }
}
