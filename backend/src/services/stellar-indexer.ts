/**
 * Stellar Indexer Service
 *
 * Streams Soroban contract events from Horizon and writes relevant rows to
 * Postgres via Prisma.
 *
 * Relevant event topics (contract-emitted):
 *  - identity:did_created      → upsert Identity row
 *  - identity:credential_added → upsert Credential row
 *  - identity:credential_revoked → mark Credential revoked
 *  - score:score_computed      → upsert ScoreSnapshot row
 *  - registry:issuer_registered → upsert Issuer row
 *
 * The indexer persists a cursor (latest indexed ledger sequence) in Redis
 * so it can resume from where it left off after restarts.
 */

import { PrismaClient } from '@prisma/client';
import { createClient as createRedisClient, RedisClientType } from 'redis';
import { Horizon } from '@stellar/stellar-sdk';
import { addressToDid } from '../utils/stellar';
import { scoreRating } from '../utils/stellar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal shape of a Horizon contract event record. */
interface HorizonContractEvent {
  id: string;
  type: string;
  ledger: number;
  ledger_closed_at: string;
  contract_id: string;
  paging_token: string;
  topic: Array<{ type: string; value: string }>;
  value: { type: string; value: string };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const CURSOR_KEY = 'indexer:cursor';
const POLL_INTERVAL_MS = 5000;

export class StellarIndexerService {
  private readonly prisma: PrismaClient;
  private readonly horizon: Horizon.Server;
  private redis: RedisClientType | null = null;
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly identityContractId: string;
  private readonly scoreContractId: string;
  private readonly registryContractId: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const horizonUrl =
      process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
    this.horizon = new Horizon.Server(horizonUrl, {
      allowHttp: horizonUrl.startsWith('http://'),
    });
    this.identityContractId = process.env.IDENTITY_CONTRACT_ID ?? '';
    this.scoreContractId = process.env.SCORE_CONTRACT_ID ?? '';
    this.registryContractId = process.env.REGISTRY_CONTRACT_ID ?? '';
  }

  // ---------- Lifecycle ----------------------------------------------------

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('[Indexer] Starting Stellar event indexer');
    await this.connectRedis();
    this.schedulePoll();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.redis) await this.redis.quit();
  }

  // ---------- Polling loop -------------------------------------------------

  private schedulePoll(): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(async () => {
      try {
        await this.poll();
      } catch (err) {
        console.error('[Indexer] Poll error:', (err as Error).message);
      } finally {
        this.schedulePoll();
      }
    }, POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    const cursor = await this.getCursor();
    const contractIds = [
      this.identityContractId,
      this.scoreContractId,
      this.registryContractId,
    ].filter((id) => id && id !== 'C...');

    if (contractIds.length === 0) return;

    for (const contractId of contractIds) {
      await this.indexContractEvents(contractId, cursor);
    }
  }

  private async indexContractEvents(
    contractId: string,
    cursor: string,
  ): Promise<void> {
    try {
      // Horizon's /contracts/:id/events endpoint via streaming
      // We use the records-based approach for reliability
      const response = await (this.horizon as any)
        .effects()
        .forAccount(contractId)
        .cursor(cursor)
        .limit(100)
        .call()
        .catch(() => null);

      if (!response?.records?.length) return;

      for (const event of response.records as HorizonContractEvent[]) {
        await this.processEvent(event);
        // Advance cursor to latest processed event
        await this.setCursor(event.paging_token);
      }
    } catch (err) {
      // Individual contract polling failure should not crash the indexer
      console.warn(`[Indexer] Failed to index contract ${contractId}:`, (err as Error).message);
    }
  }

  // ---------- Event processing --------------------------------------------

  async processEvent(event: HorizonContractEvent): Promise<void> {
    // Persist raw event for audit / replay
    await this.persistWebhookEvent(event);

    const topic = event.topic?.[0]?.value ?? '';

    try {
      if (event.contract_id === this.identityContractId) {
        await this.processIdentityEvent(topic, event);
      } else if (event.contract_id === this.scoreContractId) {
        await this.processScoreEvent(topic, event);
      } else if (event.contract_id === this.registryContractId) {
        await this.processRegistryEvent(topic, event);
      }
    } catch (err) {
      console.warn(`[Indexer] Failed to process event ${event.id}:`, (err as Error).message);
    }
  }

  private async processIdentityEvent(
    topic: string,
    event: HorizonContractEvent,
  ): Promise<void> {
    const payload = safeParseJson(event.value?.value);

    if (topic === 'did_created') {
      const address: string = payload?.owner ?? payload?.subject ?? '';
      if (address) {
        await this.prisma.identity.upsert({
          where: { address },
          create: {
            address,
            did: addressToDid(address),
            publicKeyMultibase: payload?.public_key_multibase,
            onChainCreatedAt: payload?.created_at ? BigInt(payload.created_at) : null,
            onChainUpdatedAt: payload?.updated_at ? BigInt(payload.updated_at) : null,
          },
          update: {
            onChainUpdatedAt: payload?.updated_at ? BigInt(payload.updated_at) : undefined,
          },
        });
      }
    } else if (topic === 'credential_added') {
      const credId: string = payload?.credential_id ?? '';
      const ownerAddress: string = payload?.owner ?? '';
      if (credId && ownerAddress) {
        // Ensure identity exists
        await this.prisma.identity.upsert({
          where: { address: ownerAddress },
          create: { address: ownerAddress, did: addressToDid(ownerAddress) },
          update: {},
        });

        await this.prisma.credential.upsert({
          where: { credentialId: credId },
          create: {
            credentialId: credId,
            ownerAddress,
            issuerAddress: payload?.issuer ?? '',
            credentialType: payload?.credential_type ?? 'Unknown',
            credentialHash: payload?.credential_hash,
            ipfsCid: payload?.ipfs_cid,
            expiresAt: payload?.expires_at
              ? new Date(Number(payload.expires_at) * 1000)
              : null,
          },
          update: {
            credentialHash: payload?.credential_hash,
            ipfsCid: payload?.ipfs_cid,
          },
        });
      }
    } else if (topic === 'credential_revoked') {
      const credId: string = payload?.credential_id ?? '';
      if (credId) {
        await this.prisma.credential.updateMany({
          where: { credentialId: credId },
          data: { revokedAt: new Date() },
        });
      }
    }
  }

  private async processScoreEvent(
    topic: string,
    event: HorizonContractEvent,
  ): Promise<void> {
    if (topic !== 'score_computed') return;

    const payload = safeParseJson(event.value?.value);
    const address: string = payload?.subject ?? '';
    if (!address) return;

    const score = Number(payload?.score ?? 0);
    await this.prisma.scoreSnapshot.create({
      data: {
        address,
        score,
        dataPoints: Number(payload?.data_points ?? 0),
        paymentHistory: Number(payload?.components?.payment_history ?? 0),
        transactionVolume: Number(payload?.components?.transaction_volume ?? 0),
        accountLongevity: Number(payload?.components?.account_longevity ?? 0),
        assetDiversity: Number(payload?.components?.asset_diversity ?? 0),
        crossBorderActivity: Number(payload?.components?.cross_border_activity ?? 0),
        credentialCompleteness: Number(payload?.components?.credential_completeness ?? 0),
      },
    });
  }

  private async processRegistryEvent(
    topic: string,
    event: HorizonContractEvent,
  ): Promise<void> {
    if (topic !== 'issuer_registered') return;

    const payload = safeParseJson(event.value?.value);
    const address: string = payload?.issuer ?? '';
    if (!address) return;

    await this.prisma.issuer.upsert({
      where: { address },
      create: {
        address,
        name: payload?.name ?? address,
        url: payload?.url,
        credentialTypes: payload?.credential_types ?? [],
        active: true,
      },
      update: {
        name: payload?.name ?? address,
        url: payload?.url,
        credentialTypes: payload?.credential_types ?? [],
        active: payload?.active !== false,
      },
    });
  }

  private async persistWebhookEvent(event: HorizonContractEvent): Promise<void> {
    try {
      await this.prisma.webhookEvent.upsert({
        where: { id: event.id },
        create: {
          id: event.id,
          eventType: event.topic?.[0]?.value ?? 'unknown',
          contractId: event.contract_id ?? '',
          ledgerSeq: event.ledger ?? 0,
          payload: event as unknown as Record<string, unknown>,
          processed: false,
        },
        update: {},
      });
    } catch {
      // Duplicate events are fine; ignore
    }
  }

  // ---------- Cursor management --------------------------------------------

  private async getCursor(): Promise<string> {
    if (!this.redis) return 'now';
    const cursor = await this.redis.get(CURSOR_KEY).catch(() => null);
    return cursor ?? 'now';
  }

  private async setCursor(cursor: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(CURSOR_KEY, cursor).catch(() => null);
  }

  // ---------- Redis connection ---------------------------------------------

  private async connectRedis(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url) return;
    try {
      const client = createRedisClient({ url }) as RedisClientType;
      client.on('error', (err) =>
        console.warn('[Indexer] Redis error:', err.message),
      );
      await client.connect();
      this.redis = client;
    } catch (err) {
      console.warn('[Indexer] Redis not available:', (err as Error).message);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJson(str?: string): Record<string, unknown> {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
