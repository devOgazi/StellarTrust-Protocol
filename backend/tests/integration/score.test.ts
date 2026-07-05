/**
 * Integration tests for Score API routes
 *
 * Tests the following endpoints against a mock Prisma client:
 *   GET /api/v1/score/:address
 *   GET /api/v1/score/:address/history
 *   GET /api/v1/score/:address/report
 */

import request from 'supertest';
import { Application } from 'express';
import {
  createMockPrisma,
  createTestApp,
  TEST_ADDRESS,
} from '../helpers';

process.env.JWT_SECRET = 'test-secret-key';
process.env.NODE_ENV = 'test';
// Unset contract IDs so the engine falls back to Postgres (mock) rather
// than attempting on-chain calls
delete process.env.SCORE_CONTRACT_ID;
delete process.env.IDENTITY_CONTRACT_ID;

let app: Application;
let mockPrisma: ReturnType<typeof createMockPrisma>;

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
// GET /api/v1/score/:address
// ---------------------------------------------------------------------------

describe('GET /api/v1/score/:address', () => {
  it('returns 400 for an invalid Stellar address', async () => {
    const res = await request(app).get('/api/v1/score/not-a-stellar-address');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid Stellar address/);
  });

  it('returns 404 when no score data exists', async () => {
    const res = await request(app).get(`/api/v1/score/${TEST_ADDRESS}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No score data found/);
  });

  it('returns the current credit score from the most recent snapshot', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addSnapshot({
      address: TEST_ADDRESS,
      score: 742,
      dataPoints: 1247,
      paymentHistory: 780,
      transactionVolume: 720,
      accountLongevity: 700,
      assetDiversity: 680,
      crossBorderActivity: 650,
      credentialCompleteness: 800,
    });

    const res = await request(app).get(`/api/v1/score/${TEST_ADDRESS}`);
    expect(res.status).toBe(200);

    const body = res.body;
    expect(body.subject).toBe(TEST_ADDRESS);
    expect(body.score).toBe(742);
    expect(body.rating).toBe('Very Good');
    expect(body.dataPoints).toBe(1247);
    expect(body.components).toBeDefined();
    expect(body.components.paymentHistory).toBe(780);
    expect(body.components.transactionVolume).toBe(720);
    expect(body.components.accountLongevity).toBe(700);
    expect(body.components.assetDiversity).toBe(680);
    expect(body.components.crossBorderActivity).toBe(650);
    expect(body.components.credentialCompleteness).toBe(800);
    expect(body.lastUpdated).toBeDefined();
  });

  it('assigns correct rating for each score bracket', async () => {
    const brackets = [
      { score: 850, rating: 'Exceptional' },
      { score: 760, rating: 'Very Good' },
      { score: 700, rating: 'Good' },
      { score: 620, rating: 'Fair' },
      { score: 450, rating: 'Poor' },
    ];

    for (const { score, rating } of brackets) {
      const addr = TEST_ADDRESS;
      (mockPrisma as MockPrismaWithSeed)._seed.clear();
      (mockPrisma as MockPrismaWithSeed)._seed.addSnapshot({ address: addr, score });

      const res = await request(app).get(`/api/v1/score/${addr}`);
      expect(res.status).toBe(200);
      expect(res.body.rating).toBe(rating);
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/score/:address/history
// ---------------------------------------------------------------------------

describe('GET /api/v1/score/:address/history', () => {
  it('returns 400 for an invalid Stellar address', async () => {
    const res = await request(app).get('/api/v1/score/bad/history');
    expect(res.status).toBe(400);
  });

  it('returns an empty history array when no snapshots exist', async () => {
    const res = await request(app).get(`/api/v1/score/${TEST_ADDRESS}/history`);
    expect(res.status).toBe(200);
    expect(res.body.history).toEqual([]);
    expect(res.body.address).toBe(TEST_ADDRESS);
  });

  it('returns paginated history snapshots', async () => {
    // Seed 5 snapshots
    for (let i = 0; i < 5; i++) {
      (mockPrisma as MockPrismaWithSeed)._seed.addSnapshot({
        address: TEST_ADDRESS,
        score: 700 + i * 10,
      });
    }

    const res = await request(app).get(
      `/api/v1/score/${TEST_ADDRESS}/history?limit=3&offset=0`,
    );
    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(3);
    expect(res.body.limit).toBe(3);
    expect(res.body.offset).toBe(0);
  });

  it('each history entry has the expected shape', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addSnapshot({
      address: TEST_ADDRESS,
      score: 750,
      dataPoints: 200,
      paymentHistory: 800,
      transactionVolume: 750,
      accountLongevity: 720,
      assetDiversity: 690,
      crossBorderActivity: 660,
      credentialCompleteness: 750,
    });

    const res = await request(app).get(`/api/v1/score/${TEST_ADDRESS}/history`);
    expect(res.status).toBe(200);
    const entry = res.body.history[0];
    expect(entry.score).toBe(750);
    expect(entry.rating).toBeDefined();
    expect(entry.components).toBeDefined();
    expect(entry.components.paymentHistory).toBe(800);
    expect(entry.snapshotAt).toBeDefined();
  });

  it('caps limit at 100 regardless of query param', async () => {
    const res = await request(app).get(
      `/api/v1/score/${TEST_ADDRESS}/history?limit=999`,
    );
    expect(res.status).toBe(200);
    expect(res.body.limit).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/score/:address/report
// ---------------------------------------------------------------------------

describe('GET /api/v1/score/:address/report', () => {
  it('returns 400 for an invalid Stellar address', async () => {
    const res = await request(app).get('/api/v1/score/notvalid/report');
    expect(res.status).toBe(400);
  });

  it('returns 404 when no score data exists', async () => {
    const res = await request(app).get(`/api/v1/score/${TEST_ADDRESS}/report`);
    expect(res.status).toBe(404);
  });

  it('returns a full credit report with score + history + credentials', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });
    (mockPrisma as MockPrismaWithSeed)._seed.addSnapshot({
      address: TEST_ADDRESS,
      score: 720,
      dataPoints: 500,
    });

    const res = await request(app).get(`/api/v1/score/${TEST_ADDRESS}/report`);
    expect(res.status).toBe(200);

    const report = res.body;
    expect(report.subject).toBe(TEST_ADDRESS);
    expect(report.score).toBe(720);
    expect(report.rating).toBeDefined();
    expect(Array.isArray(report.history)).toBe(true);
    expect(Array.isArray(report.verifiedCredentials)).toBe(true);
    expect(report.components).toBeDefined();
  });

  it('report includes history from previous snapshots', async () => {
    (mockPrisma as MockPrismaWithSeed)._seed.addIdentity({ address: TEST_ADDRESS });
    // Add 3 snapshots
    for (let i = 0; i < 3; i++) {
      (mockPrisma as MockPrismaWithSeed)._seed.addSnapshot({
        address: TEST_ADDRESS,
        score: 700 + i * 15,
      });
    }

    const res = await request(app).get(`/api/v1/score/${TEST_ADDRESS}/report`);
    expect(res.status).toBe(200);
    expect(res.body.history.length).toBeGreaterThan(0);
  });
});
