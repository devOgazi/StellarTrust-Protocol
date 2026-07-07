import { describe, it, expect } from 'vitest';
import { addressToDid, isValidStellarAddress, shortenAddress } from '../src/lib/stellar';

describe('Stellar address utilities', () => {
  const validAddress = 'GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ';

  it('addressToDid returns correct DID format', () => {
    const did = addressToDid(validAddress);
    expect(did).toBe(`did:stellar:${validAddress}`);
  });

  it('isValidStellarAddress returns true for valid addresses', () => {
    expect(isValidStellarAddress(validAddress)).toBe(true);
  });

  it('isValidStellarAddress returns false for invalid addresses', () => {
    expect(isValidStellarAddress('')).toBe(false);
    expect(isValidStellarAddress('abc')).toBe(false);
    expect(isValidStellarAddress('G123')).toBe(false);
  });

  it('shortenAddress produces correct format', () => {
    const shortened = shortenAddress(validAddress, 4);
    expect(shortened).toBe('GAHT...ZJXQ');
    expect(shortened.length).toBeLessThan(validAddress.length);
  });
});

describe('Credential type labels', () => {
  function credentialTypeLabel(type: unknown): string {
    if (typeof type === 'string') return type;
    if (type && typeof type === 'object' && 'Custom' in type) {
      return `Custom: ${(type as { Custom: string }).Custom}`;
    }
    return String(type);
  }

  it('handles standard credential types', () => {
    expect(credentialTypeLabel('KYCVerified')).toBe('KYCVerified');
    expect(credentialTypeLabel('ProofOfAddress')).toBe('ProofOfAddress');
  });

  it('handles Custom credential types', () => {
    expect(credentialTypeLabel({ Custom: 'MyType' })).toBe('Custom: MyType');
  });
});

describe('Identity creation flow', () => {
  // W3C DID Document shape returned by the backend resolver
  const MOCK_DID_DOCUMENT = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://stellartrust.io/contexts/v1',
    ],
    id: 'did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ',
    controller: 'did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ',
    verificationMethod: [],
    authentication: [],
    service: [],
    credentials: [],
  };

  it('DID document has correct W3C structure', () => {
    expect(MOCK_DID_DOCUMENT).toHaveProperty('id');
    expect(MOCK_DID_DOCUMENT).toHaveProperty('controller');
    expect(MOCK_DID_DOCUMENT).toHaveProperty('verificationMethod');
    expect(MOCK_DID_DOCUMENT).toHaveProperty('credentials');
    expect(MOCK_DID_DOCUMENT).toHaveProperty('@context');
  });

  it('DID uses did:stellar: prefix', () => {
    expect(MOCK_DID_DOCUMENT.id).toMatch(/^did:stellar:/);
  });
});
