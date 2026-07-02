// StellarTrust SDK entry point.
import { StellarTrustConfig } from './types';
import { IdentityClient } from './identity-client';
import { ScoreClient } from './score-client';

export { StellarTrustConfig } from './types';
export type { DIDDocument, CreditScoreResult, LenderVerificationResult } from './types';

export class StellarTrust {
  public readonly identity: IdentityClient;
  public readonly score: ScoreClient;

  constructor(config: StellarTrustConfig) {
    this.identity = new IdentityClient(config);
    this.score = new ScoreClient(config);
  }
}
