import { StellarTrustConfig } from './types';
import { IdentityClient } from './identity-client';
import { ScoreClient } from './score-client';

export { StellarTrustConfig } from './types';
export type {
  DIDDocument,
  CreditScoreResult,
  LenderVerificationResult,
  LenderVerifyRequest,
  ScoreComponents,
  VerificationMethod,
  CredentialRef,
} from './types';

export class StellarTrust {
  public readonly identity: IdentityClient;
  public readonly score: ScoreClient;

  constructor(config: StellarTrustConfig) {
    this.identity = new IdentityClient(config);
    this.score = new ScoreClient(config);
  }

  get lender(): Pick<ScoreClient, 'verify'> {
    return { verify: this.score.verify.bind(this.score) };
  }
}
