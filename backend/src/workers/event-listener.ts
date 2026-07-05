/**
 * Event Listener Worker
 *
 * Real-time Soroban event listener that feeds the StellarIndexerService.
 *
 * Uses Horizon's Server-Sent Events (SSE) streaming endpoint to receive
 * contract events in near-real-time rather than polling.  Falls back to
 * polling via the StellarIndexerService if SSE is unavailable.
 *
 * The worker:
 *   1. Opens an SSE connection to Horizon /contracts/:id/events/stream
 *   2. Parses each event
 *   3. Passes it to StellarIndexerService.processEvent() for DB persistence
 *   4. Automatically reconnects on disconnect
 */

import { PrismaClient } from '@prisma/client';
import { Horizon } from '@stellar/stellar-sdk';
import { StellarIndexerService } from '../services/stellar-indexer';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RECONNECT_DELAY_MS = 5000;   // Wait 5 s before reconnecting
const MAX_RECONNECT_ATTEMPTS = 10; // Give up after 10 consecutive failures

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export class EventListenerWorker {
  private readonly prisma: PrismaClient;
  private readonly indexer: StellarIndexerService;
  private readonly horizon: Horizon.Server;
  private running = false;
  private reconnectAttempts = 0;
  private closeHandles: Array<() => void> = [];

  private readonly identityContractId: string;
  private readonly scoreContractId: string;
  private readonly registryContractId: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.indexer = new StellarIndexerService(prisma);

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
    console.log('[EventListener] Starting real-time Soroban event listener');

    // Also start the polling indexer as a reliability backstop
    await this.indexer.start();

    // Subscribe to each contract's events
    const contractIds = [
      this.identityContractId,
      this.scoreContractId,
      this.registryContractId,
    ].filter((id) => id && id !== 'C...');

    if (contractIds.length === 0) {
      console.warn(
        '[EventListener] No contract IDs configured — skipping SSE subscription',
      );
      return;
    }

    for (const contractId of contractIds) {
      this.subscribeToContract(contractId);
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    // Close all SSE streams
    for (const close of this.closeHandles) {
      try { close(); } catch { /* ignore */ }
    }
    this.closeHandles = [];

    await this.indexer.stop();
    console.log('[EventListener] Stopped');
  }

  // ---------- SSE subscription --------------------------------------------

  private subscribeToContract(contractId: string): void {
    if (!this.running) return;

    console.log(`[EventListener] Subscribing to contract: ${contractId}`);

    try {
      // Horizon's streaming EventSource for contract effects
      const closeStream = (this.horizon as any)
        .effects()
        .forAccount(contractId)
        .cursor('now')
        .stream({
          onmessage: (event: unknown) => {
            this.handleEvent(event as Record<string, unknown>).catch((err) => {
              console.warn(
                `[EventListener] Event processing error: ${(err as Error).message}`,
              );
            });
          },
          onerror: (err: unknown) => {
            console.warn(
              `[EventListener] SSE error for contract ${contractId}:`,
              err,
            );
            this.scheduleReconnect(contractId);
          },
        });

      if (typeof closeStream === 'function') {
        this.closeHandles.push(closeStream as () => void);
      }

      // Reset reconnect counter on successful connect
      this.reconnectAttempts = 0;
    } catch (err) {
      console.warn(
        `[EventListener] Failed to subscribe to ${contractId}: ${(err as Error).message}`,
      );
      this.scheduleReconnect(contractId);
    }
  }

  private scheduleReconnect(contractId: string): void {
    if (!this.running) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[EventListener] Max reconnect attempts reached for ${contractId}. ` +
        'Falling back to polling only.',
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    console.log(
      `[EventListener] Reconnecting to ${contractId} in ${delay}ms ` +
      `(attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    setTimeout(() => {
      if (this.running) {
        this.subscribeToContract(contractId);
      }
    }, delay);
  }

  private async handleEvent(event: Record<string, unknown>): Promise<void> {
    // Delegate to the indexer for DB persistence and domain logic
    await this.indexer.processEvent(event as any);
  }
}
