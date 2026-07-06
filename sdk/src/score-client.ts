import {
  StellarTrustConfig,
  CreditScoreResult,
  LenderVerificationResult,
  LenderVerifyRequest,
} from './types';

const DEFAULT_BASE_URL = 'https://api.stellartrust.io/api/v1';

export class ScoreClient {
  constructor(private config: StellarTrustConfig) {}

  private get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      h['X-API-Key'] = this.config.apiKey;
    }
    return h;
  }

  async get(address: string): Promise<CreditScoreResult> {
    const res = await fetch(
      `${this.baseUrl}/score/${address}`,
      { headers: this.headers },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to get score: ${res.status}`);
    }
    const data = await res.json();
    return {
      score: data.score,
      rating: data.rating,
      lastUpdated: data.lastUpdated,
      components: data.components,
      verifiedCredentials: data.verifiedCredentials ?? [],
      dataPoints: data.dataPoints ?? 0,
    };
  }

  async verify(options: LenderVerifyRequest): Promise<LenderVerificationResult> {
    const {
      address,
      requiredScore = 0,
      requiredCredentials = [],
    } = options;

    const res = await fetch(
      `${this.baseUrl}/lender/verify`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          address,
          requiredScore,
          requiredCredentials,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to verify: ${res.status}`);
    }

    const data = await res.json();
    return {
      approved: data.approved,
      score: data.score,
      credentialsVerified: data.credentialsVerified,
    };
  }
}
