/**
 * KYC Bridge Service
 *
 * Interface + stubs for Phase 2 KYC provider integrations:
 *  - Smile Identity
 *  - Sumsub
 *  - Jumio
 *
 * NOTE: No live API calls are made in this version.  The provider-specific
 * implementations are marked with TODO comments and will be filled in during
 * Phase 2.  The interface is intentionally stable so that the attestation
 * pipeline and API routes can be wired up now.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** KYC verification request payload */
export interface KYCRequest {
  /** Stellar address of the subject */
  address: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** ISO 3166-1 alpha-2 country code */
  country: string;
  /** Document type: passport | national_id | drivers_license */
  documentType: 'passport' | 'national_id' | 'drivers_license';
  /** Base64-encoded front-side document image */
  documentFrontBase64: string;
  /** Base64-encoded back-side document image (optional) */
  documentBackBase64?: string;
  /** Base64-encoded selfie image for liveness check */
  selfieBase64?: string;
}

/** KYC verification result */
export interface KYCResult {
  /** Provider-assigned verification session ID */
  sessionId: string;
  /** Overall verification status */
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'REVIEW';
  /** Confidence score 0–100 (provider-specific) */
  confidence?: number;
  /** KYC tier granted (basic = phone/email only, verified = government ID) */
  kycTier: 'KYCBasic' | 'KYCVerified';
  /** Human-readable rejection reason (if status === 'REJECTED') */
  rejectionReason?: string;
  /** ISO-8601 timestamp of verification */
  verifiedAt: string;
  /** Raw provider response (for debugging) */
  rawResponse?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Abstract interface
// ---------------------------------------------------------------------------

export interface KYCProvider {
  /** Human-readable provider name */
  readonly name: string;
  /** Submit a KYC verification request */
  verify(req: KYCRequest): Promise<KYCResult>;
  /** Retrieve the status of an existing verification session */
  getStatus(sessionId: string): Promise<KYCResult>;
}

// ---------------------------------------------------------------------------
// Smile Identity stub (Phase 2)
// ---------------------------------------------------------------------------

export class SmileIdentityProvider implements KYCProvider {
  readonly name = 'SmileIdentity';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SMILE_IDENTITY_API_KEY ?? '';
  }

  // TODO (Phase 2): implement Smile Identity SDK calls
  // https://docs.smileidentity.com/
  async verify(_req: KYCRequest): Promise<KYCResult> {
    throw new Error(
      'SmileIdentity integration is not yet implemented (Phase 2)',
    );
  }

  async getStatus(_sessionId: string): Promise<KYCResult> {
    throw new Error(
      'SmileIdentity integration is not yet implemented (Phase 2)',
    );
  }
}

// ---------------------------------------------------------------------------
// Sumsub stub (Phase 2)
// ---------------------------------------------------------------------------

export class SumsubProvider implements KYCProvider {
  readonly name = 'Sumsub';
  private readonly appToken: string;
  private readonly secretKey: string;

  constructor(appToken?: string, secretKey?: string) {
    this.appToken = appToken ?? process.env.SUMSUB_APP_TOKEN ?? '';
    this.secretKey = secretKey ?? process.env.SUMSUB_SECRET_KEY ?? '';
  }

  // TODO (Phase 2): implement Sumsub REST API calls
  // https://docs.sumsub.com/reference/about-sumsub-api
  async verify(_req: KYCRequest): Promise<KYCResult> {
    throw new Error('Sumsub integration is not yet implemented (Phase 2)');
  }

  async getStatus(_sessionId: string): Promise<KYCResult> {
    throw new Error('Sumsub integration is not yet implemented (Phase 2)');
  }
}

// ---------------------------------------------------------------------------
// Jumio stub (Phase 2)
// ---------------------------------------------------------------------------

export class JumioProvider implements KYCProvider {
  readonly name = 'Jumio';

  // TODO (Phase 2): implement Jumio Netverify API calls
  // https://jumio.github.io/kyx/integration-guide.html
  async verify(_req: KYCRequest): Promise<KYCResult> {
    throw new Error('Jumio integration is not yet implemented (Phase 2)');
  }

  async getStatus(_sessionId: string): Promise<KYCResult> {
    throw new Error('Jumio integration is not yet implemented (Phase 2)');
  }
}

// ---------------------------------------------------------------------------
// KYC Bridge — provider selector + orchestration
// ---------------------------------------------------------------------------

export type ProviderName = 'smile_identity' | 'sumsub' | 'jumio';

export class KYCBridgeService {
  private readonly providers: Map<ProviderName, KYCProvider> = new Map([
    ['smile_identity', new SmileIdentityProvider()],
    ['sumsub', new SumsubProvider()],
    ['jumio', new JumioProvider()],
  ]);

  /**
   * Returns a KYC provider by name.
   * Throws if the provider name is unknown.
   */
  getProvider(name: ProviderName): KYCProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unknown KYC provider: ${name}`);
    }
    return provider;
  }

  /**
   * Lists available provider names.
   */
  listProviders(): ProviderName[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Submits a KYC verification request to the given provider.
   * Phase 1 stub — always throws "not implemented".
   */
  async verify(providerName: ProviderName, req: KYCRequest): Promise<KYCResult> {
    return this.getProvider(providerName).verify(req);
  }
}
