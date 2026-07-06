'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
} from '@/components/ui';

interface VerificationResult {
  approved: boolean;
  score: number | null;
  rating: string | null;
  scoreApproved: boolean;
  credentialsVerified: boolean;
  verifiedCredentials: string[];
  address: string;
}

export default function LenderPage() {
  const [address, setAddress] = useState('');
  const [requiredScore, setRequiredScore] = useState('650');
  const [requiredCredentials, setRequiredCredentials] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setLoading(true);
    setError(null);
    try {
      const creds = requiredCredentials
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const data = await apiClient.lenderVerify({
        address,
        requiredScore: parseInt(requiredScore) || 0,
        requiredCredentials: creds,
      });
      setResult(data as VerificationResult);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold">Lender Portal</h1>
        <p className="text-muted-foreground">
          Verify a borrower&apos;s identity and credit score. Enter their Stellar address and
          your requirements below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verify Borrower</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Stellar Address</Label>
              <Input
                id="address"
                placeholder="G..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requiredScore">Minimum Required Score</Label>
              <Input
                id="requiredScore"
                type="number"
                min={300}
                max={900}
                value={requiredScore}
                onChange={(e) => setRequiredScore(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requiredCredentials">
                Required Credentials (comma-separated)
              </Label>
              <Input
                id="requiredCredentials"
                placeholder="KYCVerified, ProofOfAddress"
                value={requiredCredentials}
                onChange={(e) => setRequiredCredentials(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={result.approved ? 'success' : 'destructive'}>
                {result.approved ? 'APPROVED' : 'DENIED'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Score:</span>{' '}
                {result.score ?? 'N/A'}
              </div>
              <div>
                <span className="text-muted-foreground">Rating:</span>{' '}
                {result.rating ?? 'N/A'}
              </div>
              <div>
                <span className="text-muted-foreground">Score Approved:</span>{' '}
                {result.scoreApproved ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="text-muted-foreground">Credentials Verified:</span>{' '}
                {result.credentialsVerified ? 'Yes' : 'No'}
              </div>
            </div>
            {result.verifiedCredentials.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Verified Credentials:
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.verifiedCredentials.map((cred) => (
                    <Badge key={cred} variant="secondary">
                      {cred}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
