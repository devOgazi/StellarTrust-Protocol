/**
 * Score Updater Worker
 *
 * Periodic background job that recomputes credit scores for all known
 * Identity addresses.  Runs on a configurable interval (default: every hour).
 *
 * For each address:
 *   1. Calls ScoreEngineService.getScore() (which queries on-chain)
 *   2. Persists a fresh ScoreSnapshot to Postgres
 *   3. Invalidates the Redis cache so subsequent reads get the new value
 *
 * The worker processes addresses in small batches to avoid overwhelming the
 * Soroban RPC endpoint.
 */

import { PrismaClient } from '@prisma/client';
import { ScoreEngineService } from '../services/score-engine';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500; // 500 ms between batches

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export class ScoreUpdaterWorker {
  private readonly prisma: PrismaClient;
  private readonly engine: ScoreEngineService;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly intervalMs: number;

  constructor(prisma: PrismaClient, intervalMs = DEFAULT_INTERVAL_MS) {
    this.prisma = prisma;
    this.engine = new ScoreEngineService(prisma);
    this.intervalMs = intervalMs;
  }

  // ---------- Lifecycle ----------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    console.log(
      `[ScoreUpdater] Starting — interval: ${this.intervalMs / 1000}s`,
    );
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.engine.closeRedis();
    console.log('[ScoreUpdater] Stopped');
  }

  // ---------- Scheduling ---------------------------------------------------

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(async () => {
      try {
        await this.run();
      } catch (err) {
        console.error('[ScoreUpdater] Run error:', (err as Error).message);
      } finally {
        this.scheduleNext();
      }
    }, this.intervalMs);
  }

  // ---------- Core update loop ----------------------------------------------

  /**
   * Triggers an immediate score update cycle (useful for testing / manual
   * trigger from the admin API).
   */
  async run(): Promise<{ updated: number; errors: number }> {
    console.log('[ScoreUpdater] Starting score update cycle');

    // Fetch all identity addresses
    const identities = await this.prisma.identity.findMany({
      select: { address: true },
    });

    let updated = 0;
    let errors = 0;

    for (let i = 0; i < identities.length; i += BATCH_SIZE) {
      const batch = identities.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ address }) => {
          try {
            // getScore() fetches on-chain + persists snapshot + sets cache
            await this.engine.getScore(address);
            await this.engine.invalidateCache(address);
            updated++;
          } catch (err) {
            errors++;
            console.warn(
              `[ScoreUpdater] Failed to update score for ${address}: ${(err as Error).message}`,
            );
          }
        }),
      );

      // Throttle between batches
      if (i + BATCH_SIZE < identities.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(
      `[ScoreUpdater] Cycle complete — updated: ${updated}, errors: ${errors}`,
    );
    return { updated, errors };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
