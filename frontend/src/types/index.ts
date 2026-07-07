// Shared TypeScript types for the StellarTrust frontend.

export type CredentialType =
  | 'KYCBasic'
  | 'KYCVerified'
  | 'ProofOfAddress'
  | 'EmploymentVerification'
  | 'IncomeVerification'
  | 'EducationCertificate'
  | 'BusinessRegistration'
  | string; // Covers Custom:<value> variants

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

export interface CredentialRef {
  id: string;
  type: string;
  issuer: string;
  issuedAt: number;
  expiresAt?: number;
  credentialHash: string;
}

// W3C DID Document shape returned by GET /api/v1/identity/:address
export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  service: Array<{ id: string; type: string; serviceEndpoint: string }>;
  credentials: CredentialRef[];
}

export interface ScoreComponents {
  paymentHistory: number;
  accountLongevity: number;
  transactionVolume: number;
  assetDiversity: number;
  crossBorderActivity: number;
  credentialCompleteness: number;
}

export interface CreditScore {
  subject: string;
  score: number;
  rating: string;
  components: ScoreComponents;
  dataPoints: number;
  lastUpdated: string; // ISO-8601
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
