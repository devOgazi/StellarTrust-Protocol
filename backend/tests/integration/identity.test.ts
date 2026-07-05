/**
 * Integration tests for Identity API routes
 *
 * Tests the following endpoints against a mock Prisma client:
 *   GET    /api/v1/identity/:address
 *   POST   /api/v1/identity/create
 *   POST   /api/v1/identity/credential
 *   DELETE /api/v1/identity/credential/:id
 */

import request from 'supertest';
import { Application } from 'express';
import {
  createMockPrisma,
  createTestApp,
  TEST_ADDRESS,
  TEST_ISSUER_ADDRESS,
  makeAuthHeader,
} from '../helpers';

// Set JWT secret before any imports fire
process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';

let app: Application;
let mockPrisma: ReturnType<typeof createMockPrisma>;

// Access the hidden _seed helper
type MockPrismaWithSeed = ReturnType<typeof createMockPrisma> & {
  _seed: {
    addIdentity: (partial: object) => void;
    addIssuer: (partial: object) => void;
    addSnapshot: (partial: object) => void;
    clear: () => void;
  };
};

beforeEach(() => {
  mockPrisma = createMockPrisma();
  app = createTestApp(mockPrisma);
  (mockPrisma as MockPrismaWithSeed)._seed.clear();
});

// ---------------------------------------------------------------------------
// GET /api/v1/identity/:address
// ---------------------------------------------------------------------------

describe('GET /api/v1/identity/:address', () => {
  it('returns 400 for an invalid Stellar address', async () => {
    const res = await request(app).get('/api/v1/identity/not-an-address');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid Stellar address/);
  });

  it('returns 404 when no DID exists for the address', async () => {
    const res = await request(app).get(`/api/v1/identity/${TEST_ADDRESS}`);
    expect(res.status).toBe(404);
  });

  it('returns a DID document for an existing identity', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });

    const res = await request(app).get(`/api/v1/identity/${TEST_ADDRESS}`);
    expect(res.status).toBe(200);

    const doc = res.body;
    expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
    expect(doc['@context']).toContain('https://stellartrust.io/contexts/v1');
    expect(doc.id).toBe(`did:stellar:${TEST_ADDRESS}`);
    expect(doc.controller).toBe(`did:stellar:${TEST_ADDRESS}`);
    expect(Array.isArray(doc.verificationMethod)).toBe(true);
    expect(Array.isArray(doc.authentication)).toBe(true);
    expect(Array.isArray(doc.service)).toBe(true);
    expect(Array.isArray(doc.credentials)).toBe(true);
  });

  it('includes service endpoint pointing to score API', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });

    const res = await request(app).get(`/api/v1/identity/${TEST_ADDRESS}`);
    expect(res.status).toBe(200);

    const scoreService = res.body.service.find(
      (s: { type: string }) => s.type === 'CreditScoreService',
    );
    expect(scoreService).toBeDefined();
    expect(scoreService.serviceEndpoint).toContain(TEST_ADDRESS);
  });

  it('includes non-revoked credentials for an existing identity', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });

    // Manually add a credential to the mock via credential.create
    await (mockPrisma.credential as any).create({
      data: {
        credentialId: 'abc123',
        ownerAddress: TEST_ADDRESS,
        issuerAddress: TEST_ISSUER_ADDRESS,
        credentialType: 'KYCVerified',
        credentialHash: '0xdeadbeef',
      },
    });

    const res = await request(app).get(`/api/v1/identity/${TEST_ADDRESS}`);
    expect(res.status).toBe(200);
    // credentials are resolved from DB by the DIDResolverService fallback path
    // The mock identity.findUnique returns credentials via include
    expect(Array.isArray(res.body.credentials)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/identity/create
// ---------------------------------------------------------------------------

describe('POST /api/v1/identity/create', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/identity/create')
      .send({ address: TEST_ADDRESS });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing address', async () => {
    const res = await request(app)
      .post('/api/v1/identity/create')
      .set(makeAuthHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid Stellar address', async () => {
    const res = await request(app)
      .post('/api/v1/identity/create')
      .set(makeAuthHeader())
      .send({ address: 'bad-address' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid Stellar address/);
  });

  it('returns 403 when creating DID for a different address', async () => {
    const res = await request(app)
      .post('/api/v1/identity/create')
      .set(makeAuthHeader(TEST_ADDRESS))              // authenticated as TEST_ADDRESS
      .send({ address: TEST_ISSUER_ADDRESS });         // but creating for different address
    expect(res.status).toBe(403);
  });

  it('creates a new DID and returns the DID document', async () => {
    const res = await request(app)
      .post('/api/v1/identity/create')
      .set(makeAuthHeader(TEST_ADDRESS))
      .send({ address: TEST_ADDRESS });

    expect(res.status).toBe(201);
    const doc = res.body;
    expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
    expect(doc.id).toBe(`did:stellar:${TEST_ADDRESS}`);
    expect(doc.controller).toBe(`did:stellar:${TEST_ADDRESS}`);
  });

  it('returns 409 when DID already exists', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });

    const res = await request(app)
      .post('/api/v1/identity/create')
      .set(makeAuthHeader(TEST_ADDRESS))
      .send({ address: TEST_ADDRESS });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/identity/credential
// ---------------------------------------------------------------------------

describe('POST /api/v1/identity/credential', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/identity/credential')
      .send({
        ownerAddress: TEST_ADDRESS,
        issuerAddress: TEST_ISSUER_ADDRESS,
        credentialType: 'KYCVerified',
      });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/identity/credential')
      .set(makeAuthHeader())
      .send({ ownerAddress: TEST_ADDRESS });
    expect(res.status).toBe(400);
  });

  it('allows an issuer to add a credential', async () => {
    // Seed: identity exists, caller is a registered issuer
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });
    (mockPrisma as MockPrismaWithSeed)._seed.addIssuer({ address: TEST_ISSUER_ADDRESS });

    const res = await request(app)
      .post('/api/v1/identity/credential')
      .set(makeAuthHeader(TEST_ISSUER_ADDRESS))
      .send({
        ownerAddress: TEST_ADDRESS,
        issuerAddress: TEST_ISSUER_ADDRESS,
        credentialType: 'KYCVerified',
        credentialHash: '0xdeadbeef',
      });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe('KYCVerified');
    expect(res.body.issuer).toBe(`did:stellar:${TEST_ISSUER_ADDRESS}`);
    expect(res.body.credentialHash).toBe('0xdeadbeef');
  });

  it('allows an account owner to add their own credential', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIssuer({ address: TEST_ADDRESS });

    const res = await request(app)
      .post('/api/v1/identity/credential')
      .set(makeAuthHeader(TEST_ADDRESS))
      .send({
        ownerAddress: TEST_ADDRESS,
        issuerAddress: TEST_ADDRESS,
        credentialType: 'ProofOfAddress',
      });

    expect(res.status).toBe(201);
  });

  it('returns 403 when caller is neither owner nor issuer', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });
    // No issuer record for TEST_ISSUER_ADDRESS

    const res = await request(app)
      .post('/api/v1/identity/credential')
      .set(makeAuthHeader(TEST_ISSUER_ADDRESS))  // authenticated but not a registered issuer
      .send({
        ownerAddress: TEST_ADDRESS,
        issuerAddress: TEST_ISSUER_ADDRESS,
        credentialType: 'KYCVerified',
      });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/identity/credential/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/identity/credential/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/v1/identity/credential/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown credential', async () => {
    const res = await request(app)
      .delete('/api/v1/identity/credential/unknown-cred-id')
      .set(makeAuthHeader());
    expect(res.status).toBe(404);
  });

  it('revokes a credential when called by the owner', async () => {
    // Seed a credential
    await (mockPrisma.credential as any).create({
      data: {
        credentialId: 'cred-abc',
        ownerAddress: TEST_ADDRESS,
        issuerAddress: TEST_ISSUER_ADDRESS,
        credentialType: 'KYCVerified',
        credentialHash: null,
      },
    });

    const res = await request(app)
      .delete('/api/v1/identity/credential/cred-abc')
      .set(makeAuthHeader(TEST_ADDRESS));
    expect(res.status).toBe(200);
    expect(res.body.credentialId).toBe('cred-abc');
  });

  it('returns 403 when called by a third party', async () => {
    await (mockPrisma.credential as any).create({
      data: {
        credentialId: 'cred-xyz',
        ownerAddress: TEST_ADDRESS,
        issuerAddress: TEST_ISSUER_ADDRESS,
        credentialType: 'KYCVerified',
        credentialHash: null,
      },
    });

    // Authenticated as TEST_ISSUER_ADDRESS (the issuer IS allowed, so use a random non-issuer)
    const outsiderAddress = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGZIXRYUJ5XUTAWBPXC3HDXH1';
    const res = await request(app)
      .delete('/api/v1/identity/credential/cred-xyz')
      .set(makeAuthHeader(outsiderAddress));
    expect(res.status).toBe(403);
  });
});
