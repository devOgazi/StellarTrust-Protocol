'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  type SelectOption,
} from '@/components/ui';
import { apiClient } from '@/lib/api';

const CREDENTIAL_TYPE_OPTIONS: SelectOption[] = [
  { value: 'KYCBasic', label: 'KYC Basic' },
  { value: 'KYCVerified', label: 'KYC Verified' },
  { value: 'ProofOfAddress', label: 'Proof of Address' },
  { value: 'EmploymentVerification', label: 'Employment Verification' },
  { value: 'IncomeVerification', label: 'Income Verification' },
  { value: 'EducationCertificate', label: 'Education Certificate' },
  { value: 'BusinessRegistration', label: 'Business Registration' },
];

interface AddCredentialFormProps {
  ownerAddress: string;
  onAdded?: () => void;
}

export function AddCredentialForm({ ownerAddress, onAdded }: AddCredentialFormProps) {
  const [credentialType, setCredentialType] = useState('');
  const [issuerAddress, setIssuerAddress] = useState('');
  const [credentialHash, setCredentialHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialType || !issuerAddress) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.addCredential({
        ownerAddress,
        issuerAddress,
        credentialType,
        credentialHash: credentialHash || undefined,
      });
      setCredentialType('');
      setIssuerAddress('');
      setCredentialHash('');
      onAdded?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Credential</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="credentialType">Credential Type</Label>
            <Select
              id="credentialType"
              options={CREDENTIAL_TYPE_OPTIONS}
              placeholder="Select credential type"
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issuerAddress">Issuer Address</Label>
            <Input
              id="issuerAddress"
              placeholder="G..."
              value={issuerAddress}
              onChange={(e) => setIssuerAddress(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credentialHash">Credential Hash (optional)</Label>
            <Input
              id="credentialHash"
              placeholder="0x..."
              value={credentialHash}
              onChange={(e) => setCredentialHash(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Adding...' : 'Add Credential'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
