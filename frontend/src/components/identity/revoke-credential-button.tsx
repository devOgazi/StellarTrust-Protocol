'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { apiClient } from '@/lib/api';

interface RevokeCredentialButtonProps {
  credentialId: string;
  onRevoked?: () => void;
}

export function RevokeCredentialButton({
  credentialId,
  onRevoked,
}: RevokeCredentialButtonProps) {
  const [revoking, setRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke this credential?')) return;
    setRevoking(true);
    try {
      await apiClient.revokeCredential(credentialId);
      onRevoked?.();
    } catch {
      // error handled silently
    } finally {
      setRevoking(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleRevoke}
      disabled={revoking}
      className="text-destructive hover:text-destructive"
    >
      {revoking ? 'Revoking...' : 'Revoke'}
    </Button>
  );
}
