// SDK types — placeholder.
export interface StellarTrustConfig {
  network: 'mainnet' | 'testnet';
  apiKey?: string;
}

export interface DIDDocument {
  did: string;
  controller: string;
  credentials: CredentialRef[];
}

export interface CredentialRef {
  id: string;
  credential_type: string;
  issuer: string;
  issued_at: number;
  expires_at?: number;
}

export interface CreditScoreResult {
  score: number;
  rating: string;
  lastUpdated: string;
  components: Record<string, number>;
  verifiedCredentials: string[];
  dataPoints: number;
}

export interface LenderVerificationResult {
  approved: boolean;
  score: number;
  credentialsVerified: boolean;
}
