export interface StellarTrustConfig {
  network: 'mainnet' | 'testnet';
  apiKey?: string;
  baseUrl?: string;
}

export interface DIDDocument {
  did: string;
  controller: string;
  verification_methods: VerificationMethod[];
  credentials: CredentialRef[];
  created_at: number;
  updated_at: number;
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
}

export interface CredentialRef {
  id: string;
  type: string;
  issuer: string;
  issuedAt: number;
  expiresAt?: number;
  credentialHash?: string;
}

export interface CreditScoreResult {
  score: number;
  rating: string;
  lastUpdated: string;
  components: ScoreComponents;
  verifiedCredentials: string[];
  dataPoints: number;
}

export interface ScoreComponents {
  paymentHistory: number;
  accountLongevity: number;
  transactionVolume: number;
  assetDiversity: number;
  crossBorderActivity: number;
  credentialCompleteness: number;
}

export interface LenderVerificationResult {
  approved: boolean;
  score: number;
  credentialsVerified: boolean;
}

export interface LenderVerifyRequest {
  address: string;
  requiredScore?: number;
  requiredCredentials?: string[];
}
