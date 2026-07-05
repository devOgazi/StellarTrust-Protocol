/**
 * Test helpers — shared utilities for integration tests.
 *
 * Uses an in-memory mock Prisma client so tests can run without a live
 * Postgres instance.  For CI/CD with a real DB the mock can be replaced
 * with a real PrismaClient pointing at a test database.
 */

import { Application } from 'express';
import { PrismaClient } from '@prisma/client';
import { issueJWT } from '../src/middleware/auth';

// ---------------------------------------------------------------------------
// Shared Stellar test address (a valid G... key for test use)
// ---------------------------------------------------------------------------
export const TEST_ADDRESS = 'GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ';
export const TEST_ADDRESS_2 = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGZIXRYUJ5XUTAWBPXC3HDXH1';
export const TEST_ISSUER_ADDRESS = 'GCSJ7MFIIGIRMAS4R3VT5FIFIAOXNMGDI5ZFYCS5FVKDIBZRP7MWDH3';

// ---------------------------------------------------------------------------
// JWT for test requests
// ---------------------------------------------------------------------------

export function makeTestToken(address: string = TEST_ADDRESS): string {
  process.env.JWT_SECRET = 'test-secret-key';
  return issueJWT(address);
}

export function makeAuthHeader(address: string = TEST_ADDRESS): { Authorization: string } {
  return { Authorization: `Bearer ${makeTestToken(address)}` };
}

// ---------------------------------------------------------------------------
// In-memory data stores for mock Prisma
// ---------------------------------------------------------------------------

interface MockIdentity {
  id: string;
  address: string;
  did: string;
  publicKeyMultibase: string | null;
  onChainCreatedAt: bigint | null;
  onChainUpdatedAt: bigint | null;
  createdAt: Date;
  updatedAt: Date;
  credentials?: MockCredential[];
}

interface MockCredential {
  id: string;
  credentialId: string;
  ownerAddress: string;
  issuerAddress: string;
  credentialType: string;
  credentialHash: string | null;
  ipfsCid: string | null;
  issuedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

interface MockIssuer {
  id: string;
  address: string;
  name: string;
  url: string | null;
  credentialTypes: string[];
  registeredAt: Date;
  updatedAt: Date;
  active: boolean;
}

interface MockScoreSnapshot {
  id: string;
  address: string;
  score: number;
  dataPoints: number;
  paymentHistory: number;
  transactionVolume: number;
  accountLongevity: number;
  assetDiversity: number;
  crossBorderActivity: number;
  credentialCompleteness: number;
  snapshotAt: Date;
}

interface MockAttestationRecord {
  id: string;
  issuerAddress: string;
  subjectAddress: string;
  claimKey: string;
  claimValue: string;
  attestedAt: Date;
  expiresAt: Date | null;
}

interface MockWebhookEvent {
  id: string;
  eventType: string;
  contractId: string;
  ledgerSeq: number;
  payload: Record<string, unknown>;
  processed: boolean;
  processedAt: Date | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------

export function createMockPrisma(): PrismaClient {
  // In-memory stores
  const identities: MockIdentity[] = [];
  const credentials: MockCredential[] = [];
  const issuers: MockIssuer[] = [];
  const snapshots: MockScoreSnapshot[] = [];
  const attestations: MockAttestationRecord[] = [];
  const webhookEvents: MockWebhookEvent[] = [];

  let idCounter = 0;
  const nextId = () => `id_${++idCounter}`;

  function attachCredentials(identity: MockIdentity): MockIdentity {
    return {
      ...identity,
      credentials: credentials.filter(
        (c) => c.ownerAddress === identity.address,
      ),
    };
  }

  const mock = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),

    identity: {
      findUnique: jest.fn(({ where, include }: any) => {
        let record = identities.find(
          (i) => i.address === where?.address || i.id === where?.id,
        );
        if (!record) return Promise.resolve(null);
        if (include?.credentials) {
          record = attachCredentials(record);
        }
        return Promise.resolve(record ? { ...record } : null);
      }),

      findMany: jest.fn(({ where }: any = {}) => {
        let result = [...identities];
        if (where?.address) {
          result = result.filter((i) => i.address === where.address);
        }
        return Promise.resolve(result);
      }),

      create: jest.fn(({ data }: any) => {
        const record: MockIdentity = {
          id: nextId(),
          address: data.address,
          did: data.did,
          publicKeyMultibase: data.publicKeyMultibase ?? null,
          onChainCreatedAt: data.onChainCreatedAt ?? null,
          onChainUpdatedAt: data.onChainUpdatedAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        identities.push(record);
        return Promise.resolve({ ...record });
      }),

      upsert: jest.fn(({ where, create, update }: any) => {
        let record = identities.find((i) => i.address === where.address);
        if (record) {
          Object.assign(record, update, { updatedAt: new Date() });
        } else {
          const newRecord: MockIdentity = {
            id: nextId(),
            ...create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          identities.push(newRecord);
          record = newRecord;
        }
        return Promise.resolve({ ...record });
      }),

      update: jest.fn(({ where, data }: any) => {
        const record = identities.find((i) => i.address === where.address);
        if (!record) throw new Error('Record not found');
        Object.assign(record, data, { updatedAt: new Date() });
        return Promise.resolve({ ...record });
      }),
    },

    credential: {
      findUnique: jest.fn(({ where }: any) => {
        const record = credentials.find(
          (c) => c.credentialId === where?.credentialId,
        );
        return Promise.resolve(record ? { ...record } : null);
      }),

      findMany: jest.fn(({ where }: any = {}) => {
        let result = [...credentials];
        if (where?.ownerAddress) {
          result = result.filter((c) => c.ownerAddress === where.ownerAddress);
        }
        return Promise.resolve(result);
      }),

      create: jest.fn(({ data }: any) => {
        const record: MockCredential = {
          id: nextId(),
          credentialId: data.credentialId,
          ownerAddress: data.ownerAddress,
          issuerAddress: data.issuerAddress,
          credentialType: data.credentialType,
          credentialHash: data.credentialHash ?? null,
          ipfsCid: data.ipfsCid ?? null,
          issuedAt: new Date(),
          expiresAt: data.expiresAt ?? null,
          revokedAt: null,
        };
        credentials.push(record);
        return Promise.resolve({ ...record });
      }),

      update: jest.fn(({ where, data }: any) => {
        const record = credentials.find(
          (c) => c.credentialId === where.credentialId,
        );
        if (!record) throw new Error('Credential not found');
        Object.assign(record, data);
        return Promise.resolve({ ...record });
      }),

      updateMany: jest.fn(({ where, data }: any) => {
        credentials
          .filter((c) => c.credentialId === where.credentialId)
          .forEach((c) => Object.assign(c, data));
        return Promise.resolve({ count: 1 });
      }),

      upsert: jest.fn(({ where, create, update }: any) => {
        let record = credentials.find(
          (c) => c.credentialId === where.credentialId,
        );
        if (record) {
          Object.assign(record, update);
        } else {
          const newRecord: MockCredential = {
            id: nextId(),
            ...create,
            issuedAt: new Date(),
            revokedAt: null,
          };
          credentials.push(newRecord);
          record = newRecord;
        }
        return Promise.resolve({ ...record });
      }),
    },

    issuer: {
      findUnique: jest.fn(({ where }: any) => {
        const record = issuers.find(
          (i) => i.address === where?.address || i.id === where?.id,
        );
        return Promise.resolve(record ? { ...record } : null);
      }),

      findMany: jest.fn(({ where, orderBy, select }: any = {}) => {
        let result = [...issuers];
        if (where?.active !== undefined) {
          result = result.filter((i) => i.active === where.active);
        }
        return Promise.resolve(result);
      }),

      create: jest.fn(({ data }: any) => {
        const record: MockIssuer = {
          id: nextId(),
          address: data.address,
          name: data.name,
          url: data.url ?? null,
          credentialTypes: data.credentialTypes ?? [],
          registeredAt: new Date(),
          updatedAt: new Date(),
          active: data.active !== undefined ? data.active : true,
        };
        issuers.push(record);
        return Promise.resolve({ ...record });
      }),

      upsert: jest.fn(({ where, create, update }: any) => {
        let record = issuers.find((i) => i.address === where.address);
        if (record) {
          Object.assign(record, update, { updatedAt: new Date() });
        } else {
          const newRecord: MockIssuer = { id: nextId(), ...create, registeredAt: new Date(), updatedAt: new Date() };
          issuers.push(newRecord);
          record = newRecord;
        }
        return Promise.resolve({ ...record });
      }),
    },

    scoreSnapshot: {
      findFirst: jest.fn(({ where, orderBy }: any = {}) => {
        const results = snapshots.filter((s) => s.address === where?.address);
        if (results.length === 0) return Promise.resolve(null);
        return Promise.resolve({ ...results[results.length - 1] });
      }),

      findMany: jest.fn(({ where, orderBy, take, skip }: any = {}) => {
        let result = snapshots.filter((s) => s.address === where?.address);
        // Apply simple desc sort by snapshotAt
        result.sort((a, b) => b.snapshotAt.getTime() - a.snapshotAt.getTime());
        if (skip) result = result.slice(skip);
        if (take) result = result.slice(0, take);
        return Promise.resolve(result);
      }),

      create: jest.fn(({ data }: any) => {
        const record: MockScoreSnapshot = {
          id: nextId(),
          address: data.address,
          score: data.score,
          dataPoints: data.dataPoints ?? 0,
          paymentHistory: data.paymentHistory ?? 0,
          transactionVolume: data.transactionVolume ?? 0,
          accountLongevity: data.accountLongevity ?? 0,
          assetDiversity: data.assetDiversity ?? 0,
          crossBorderActivity: data.crossBorderActivity ?? 0,
          credentialCompleteness: data.credentialCompleteness ?? 0,
          snapshotAt: new Date(),
        };
        snapshots.push(record);
        return Promise.resolve({ ...record });
      }),
    },

    attestationRecord: {
      create: jest.fn(({ data }: any) => {
        const record: MockAttestationRecord = {
          id: nextId(),
          issuerAddress: data.issuerAddress,
          subjectAddress: data.subjectAddress,
          claimKey: data.claimKey,
          claimValue: data.claimValue,
          attestedAt: new Date(),
          expiresAt: data.expiresAt ?? null,
        };
        attestations.push(record);
        return Promise.resolve({ ...record });
      }),

      findMany: jest.fn(({ where }: any = {}) => {
        let result = [...attestations];
        if (where?.subjectAddress) {
          result = result.filter((a) => a.subjectAddress === where.subjectAddress);
        }
        return Promise.resolve(result);
      }),
    },

    webhookEvent: {
      create: jest.fn(({ data }: any) => {
        const record: MockWebhookEvent = {
          id: data.id ?? nextId(),
          eventType: data.eventType,
          contractId: data.contractId ?? '',
          ledgerSeq: data.ledgerSeq ?? 0,
          payload: data.payload,
          processed: false,
          processedAt: null,
          createdAt: new Date(),
        };
        webhookEvents.push(record);
        return Promise.resolve({ ...record });
      }),

      upsert: jest.fn(({ where, create, update }: any) => {
        let record = webhookEvents.find((e) => e.id === where.id);
        if (!record) {
          const newRecord: MockWebhookEvent = {
            ...create,
            processedAt: null,
            createdAt: new Date(),
          };
          webhookEvents.push(newRecord);
          record = newRecord;
        }
        return Promise.resolve({ ...record });
      }),
    },

    // Helper to seed test data (not a Prisma method, used by tests)
    _seed: {
      addIssuer: (issuer: Partial<MockIssuer>) => {
        const record: MockIssuer = {
          id: nextId(),
          address: issuer.address ?? TEST_ISSUER_ADDRESS,
          name: issuer.name ?? 'Test Issuer',
          url: issuer.url ?? null,
          credentialTypes: issuer.credentialTypes ?? ['KYCVerified'],
          registeredAt: new Date(),
          updatedAt: new Date(),
          active: true,
          ...issuer,
        };
        issuers.push(record);
        return record;
      },

      addIdentity: (partial: Partial<MockIdentity>) => {
        const addr = partial.address ?? TEST_ADDRESS;
        const record: MockIdentity = {
          id: nextId(),
          address: addr,
          did: `did:stellar:${addr}`,
          publicKeyMultibase: null,
          onChainCreatedAt: null,
          onChainUpdatedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...partial,
        };
        identities.push(record);
        return record;
      },

      addSnapshot: (partial: Partial<MockScoreSnapshot>) => {
        const record: MockScoreSnapshot = {
          id: nextId(),
          address: partial.address ?? TEST_ADDRESS,
          score: partial.score ?? 750,
          dataPoints: 100,
          paymentHistory: 780,
          transactionVolume: 720,
          accountLongevity: 700,
          assetDiversity: 650,
          crossBorderActivity: 600,
          credentialCompleteness: 800,
          snapshotAt: new Date(),
          ...partial,
        };
        snapshots.push(record);
        return record;
      },

      clear: () => {
        identities.length = 0;
        credentials.length = 0;
        issuers.length = 0;
        snapshots.length = 0;
        attestations.length = 0;
        webhookEvents.length = 0;
        idCounter = 0;
      },
    },
  };

  return mock as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// App factory that injects mock Prisma
// ---------------------------------------------------------------------------

export function createTestApp(prisma: PrismaClient): Application {
  // Patch the index module to use our mock prisma by re-exporting createApp
  // with dependency injection.  Since createApp uses a shared module-level
  // prisma we need to directly wire the routers with our mock.
  const express = require('express');
  const { requestId, loggerMiddleware, errorLogger } = require('../src/middleware/logger');
  const { apiRateLimit } = require('../src/middleware/ratelimit');
  const { createIdentityRouter } = require('../src/api/identity');
  const { createScoreRouter } = require('../src/api/score');
  const { createAttestRouter } = require('../src/api/credentials');
  const { createWebhookRouter } = require('../src/api/webhooks');
  const { createRegistryRouter } = require('../src/api/registry');
  const { createLenderRouter } = require('../src/api/lender');
  const { createAuthRouter } = require('../src/api/auth');

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(requestId);
  app.use(loggerMiddleware);

  app.get('/health', (_req: any, res: any) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use('/auth',     createAuthRouter());
  api.use('/identity', createIdentityRouter(prisma));
  api.use('/score',    createScoreRouter(prisma));
  api.use('/attest',   createAttestRouter(prisma));
  api.use('/webhooks', createWebhookRouter(prisma));
  api.use('/registry', createRegistryRouter(prisma));
  api.use('/lender',   createLenderRouter(prisma));
  app.use('/api/v1', api);

  app.use((_req: any, res: any) => res.status(404).json({ error: 'Not found' }));
  app.use(errorLogger);
  app.use((err: Error, _req: any, res: any, _next: any) =>
    res.status(500).json({ error: err.message }),
  );

  return app;
}
