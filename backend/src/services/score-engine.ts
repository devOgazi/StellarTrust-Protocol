/**
 * Score Engine Service
 *
 * Off-chain assist for credit score computation.  Responsibilities:
 *   1. Query the Soroban Score contract for the current on-chain score
 *   2. Cache results in Redis (TTL configurable, default 5 minutes)
 *   3. Retrieve score history from the local Postgres ScoreSnapshot table
 *   4. Assemble the full credit report returned by GET /score/:address/report
 */

import { PrismaClient } from '@prisma/client';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import {
  simulateContractCall,
  addressToScVal,
  scoreRating,
  isValidStellarAddress,
} from '../utils/stellar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreComponents {
  paymentHistory: number;
  transactionVolume: number;
  accountLongevity: number;
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

export interface ScoreHistoryEntry {
  score: number;
  rating: string;
  components: ScoreComponents;
  dataPoints: number;
  snapshotAt: string; // ISO-8601
}

export interface CreditReport extends CreditScore {
  history: ScoreHistoryEntry[];
  verifiedCredentials: string[];
}

// Raw shape returned by the Soroban score contract (native-decoded)
interface OnChainScore {
  subject: string;
  score: number | bigint;
  components: {
    payment_history: number | bigint;
    transaction_volume: number | bigint;
    account_longevity: number | bigint;
    asset_diversity: number | bigint;
    cross_border_activity: number | bigint;
    credential_completeness: number | bigint;
  };
  last_updated: bigint;
  data_points: number | bigint;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_KEY_PREFIX = 'score:';

export class ScoreEngineService {
  private readonly prisma: PrismaClient;
  private readonly scoreContractId: string;
  private redis: RedisClientType | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.scoreContractId = process.env.SCORE_CONTRACT_ID ?? '';
  }

  // ---------- Redis connection (lazy) ------------------------------------

  private async getRedis(): Promise<RedisClientType | null> {
    if (this.redis) return this.redis;
    const url = process.env.REDIS_URL;
    if (!url) return null;
    try {
      const client = createRedisClient({ url }) as RedisClientType;
      client.on('error', (err) =>
        console.warn('[ScoreEngine] Redis error:', err.message),
      );
      await client.connect();
      this.redis = client;
      return this.redis;
    } catch {
      return null;
    }
  }

  async closeRedis(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  // ---------- Public API ---------------------------------------------------

  /**
   * Returns the current credit score for `address`.
   * Checks Redis cache first, then queries the on-chain contract,
   * then falls back to the latest Postgres snapshot.
   */
  async getScore(address: string): Promise<CreditScore> {
    if (!isValidStellarAddress(address)) {
      throw new Error(`Invalid Stellar address: ${address}`);
    }

    // 1. Cache hit
    const cached = await this.getCached(address);
    if (cached) return cached;

    // 2. On-chain
    let score: CreditScore | null = null;
    if (this.scoreContractId && this.scoreContractId !== 'C...') {
      try {
        score = await this.fetchOnChain(address);
        await this.persistSnapshot(address, score);
      } catch (err) {
        console.warn(`[ScoreEngine] On-chain query failed: ${(err as Error).message}`);
      }
    }

    // 3. Postgres fallback
    if (!score) {
      score = await this.fetchFromDB(address);
    }

    if (!score) {
      throw new Error(`No score data found for address: ${address}`);
    }

    await this.setCache(address, score);
    return score;
  }

  /**
   * Returns paginated score history for `address`.
   * Always reads from Postgres (Soroban has limited history storage).
   *
   * @param limit  Maximum snapshots to return (default 20)
   * @param offset Pagination offset (default 0)
   */
  async getScoreHistory(
    address: string,
    limit = 20,
    offset = 0,
  ): Promise<ScoreHistoryEntry[]> {
    const rows = await this.prisma.scoreSnapshot.findMany({
      where: { address },
      orderBy: { snapshotAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return rows.map((r) => ({
      score: r.score,
      rating: scoreRating(r.score),
      components: {
        paymentHistory: r.paymentHistory,
        transactionVolume: r.transactionVolume,
        accountLongevity: r.accountLongevity,
        assetDiversity: r.assetDiversity,
        crossBorderActivity: r.crossBorderActivity,
        credentialCompleteness: r.credentialCompleteness,
      },
      dataPoints: r.dataPoints,
      snapshotAt: r.snapshotAt.toISOString(),
    }));
  }

  /**
   * Assembles the full credit report (current score + history + credentials).
   */
  async getCreditReport(address: string): Promise<CreditReport> {
    const [current, history, identity] = await Promise.all([
      this.getScore(address),
      this.getScoreHistory(address, 10),
      this.prisma.identity.findUnique({
        where: { address },
        include: {
          credentials: {
            where: { revokedAt: null, expiresAt: { gt: new Date() } },
            select: { credentialType: true },
          },
        },
      }),
    ]);

    const verifiedCredentials = identity
      ? identity.credentials.map((c) => c.credentialType)
      : [];

    return { ...current, history, verifiedCredentials };
  }

  /**
   * Forces a cache invalidation for `address`.
   * Called by the score-updater worker after recomputing a score.
   */
  async invalidateCache(address: string): Promise<void> {
    const r = await this.getRedis();
    if (r) {
      await r.del(`${CACHE_KEY_PREFIX}${address}`);
    }
  }

  // ---------- Private helpers -----------------------------------------------

  private async fetchOnChain(address: string): Promise<CreditScore> {
    const raw = await simulateContractCall<OnChainScore | null>({
      contractId: this.scoreContractId,
      method: 'get_score',
      args: [addressToScVal(address)],
      sourceAccount: address,
    });

    if (!raw) throw new Error('Contract returned null score');
    return mapOnChainScore(raw);
  }

  private async fetchFromDB(address: string): Promise<CreditScore | null> {
    const snapshot = await this.prisma.scoreSnapshot.findFirst({
      where: { address },
      orderBy: { snapshotAt: 'desc' },
    });

    if (!snapshot) return null;

    return {
      subject: address,
      score: snapshot.score,
      rating: scoreRating(snapshot.score),
      components: {
        paymentHistory: snapshot.paymentHistory,
        transactionVolume: snapshot.transactionVolume,
        accountLongevity: snapshot.accountLongevity,
        assetDiversity: snapshot.assetDiversity,
        crossBorderActivity: snapshot.crossBorderActivity,
        credentialCompleteness: snapshot.credentialCompleteness,
      },
      dataPoints: snapshot.dataPoints,
      lastUpdated: snapshot.snapshotAt.toISOString(),
    };
  }

  private async persistSnapshot(address: string, score: CreditScore): Promise<void> {
    try {
      await this.prisma.scoreSnapshot.create({
        data: {
          address,
          score: score.score,
          dataPoints: score.dataPoints,
          paymentHistory: score.components.paymentHistory,
          transactionVolume: score.components.transactionVolume,
          accountLongevity: score.components.accountLongevity,
          assetDiversity: score.components.assetDiversity,
          crossBorderActivity: score.components.crossBorderActivity,
          credentialCompleteness: score.components.credentialCompleteness,
        },
      });
    } catch (err) {
      // Non-fatal — snapshot persistence failure shouldn't break the response
      console.warn('[ScoreEngine] Failed to persist snapshot:', (err as Error).message);
    }
  }

  private async getCached(address: string): Promise<CreditScore | null> {
    const r = await this.getRedis();
    if (!r) return null;
    try {
      const raw = await r.get(`${CACHE_KEY_PREFIX}${address}`);
      return raw ? (JSON.parse(raw) as CreditScore) : null;
    } catch {
      return null;
    }
  }

  private async setCache(address: string, score: CreditScore): Promise<void> {
    const r = await this.getRedis();
    if (!r) return;
    try {
      await r.set(
        `${CACHE_KEY_PREFIX}${address}`,
        JSON.stringify(score),
        { EX: CACHE_TTL_SECONDS },
      );
    } catch {
      // Non-fatal
    }
  }
}

// ---------------------------------------------------------------------------
// Mapper helpers
// ---------------------------------------------------------------------------

function toNum(v: number | bigint | undefined): number {
  if (v === undefined || v === null) return 0;
  return typeof v === 'bigint' ? Number(v) : v;
}

function mapOnChainScore(raw: OnChainScore): CreditScore {
  const score = toNum(raw.score);
  return {
    subject: raw.subject,
    score,
    rating: scoreRating(score),
    components: {
      paymentHistory: toNum(raw.components?.payment_history),
      transactionVolume: toNum(raw.components?.transaction_volume),
      accountLongevity: toNum(raw.components?.account_longevity),
      assetDiversity: toNum(raw.components?.asset_diversity),
      crossBorderActivity: toNum(raw.components?.cross_border_activity),
      credentialCompleteness: toNum(raw.components?.credential_completeness),
    },
    dataPoints: toNum(raw.data_points),
    lastUpdated: new Date(toNum(raw.last_updated) * 1000).toISOString(),
  };
}
