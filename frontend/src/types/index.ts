// Shared TypeScript types for the StellarTrust frontend.

export type CredentialType =
  | 'KYCBasic'
  | 'KYCVerified'
  | 'ProofOfAddress'
  | 'EmploymentVerification'
  | 'IncomeVerification'
  | 'EducationCertificate'
  | 'BusinessRegistration'
  | { Custom: string };

export interface VerificationMethod {
  id: string;
  key_type: string;
  controller: string;
  public_key: string;
}

export interface CredentialRef {
  id: string;
  credential_type: CredentialType;
  issuer: string;
  issued_at: number;
  expires_at?: number;
  credential_hash: string;
}

export interface DIDDocument {
  did: string;
  controller: string;
  verification_methods: VerificationMethod[];
  credentials: CredentialRef[];
  created_at: number;
  updated_at: number;
}

export interface ScoreComponents {
  payment_history: number;
  account_longevity: number;
  transaction_volume: number;
  asset_diversity: number;
  cross_border_activity: number;
  credential_completeness: number;
}

export interface CreditScore {
  subject: string;
  score: number;
  components: ScoreComponents;
  last_updated: number;
  data_points: number;
}

export type ScoreRating =
  | 'Exceptional'
  | 'Very Good'
  | 'Good'
  | 'Fair'
  | 'Poor';

export function scoreRating(score: number): ScoreRating {
  if (score >= 800) return 'Exceptional';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Poor';
}
