'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { RevokeCredentialButton } from './revoke-credential-button';
import type { CredentialRef } from '@/types';

interface CredentialListProps {
  credentials: CredentialRef[];
  loading?: boolean;
  onRevoked?: () => void;
}

function credentialTypeLabel(type: unknown): string {
  if (typeof type === 'string') return type;
  if (type && typeof type === 'object' && 'Custom' in type) {
    return `Custom: ${(type as { Custom: string }).Custom}`;
  }
  return String(type);
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString();
}

export function CredentialList({ credentials, loading, onRevoked }: CredentialListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!credentials.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No credentials yet. Add your first credential to build your on-chain identity.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credentials ({credentials.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {credentialTypeLabel(cred.credential_type)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Issued by {cred.issuer} &middot; {formatDate(cred.issued_at)}
                </p>
              </div>
              <RevokeCredentialButton
                credentialId={cred.id}
                onRevoked={onRevoked}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
