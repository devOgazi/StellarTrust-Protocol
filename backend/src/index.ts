/**
 * StellarTrust Protocol — Backend API Server
 *
 * Entry point.  Wires together:
 *   - Express app + middleware
 *   - All API routers mounted at /api/v1
 *   - Prisma database client
 *   - Background workers (score-updater, event-listener)
 *   - Graceful shutdown
 */

import "dotenv/config";
import express, { Application, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

// Middleware
import { requestId, loggerMiddleware, errorLogger } from "./middleware/logger";
import { apiRateLimit } from "./middleware/ratelimit";

// API routers
import { createIdentityRouter } from "./api/identity";
import { createScoreRouter } from "./api/score";
import { createAttestRouter } from "./api/credentials";
import { createWebhookRouter } from "./api/webhooks";
import { createRegistryRouter } from "./api/registry";
import { createLenderRouter } from "./api/lender";
import { createAuthRouter } from "./api/auth";
import { createContractRouter } from "./api/contract";

// Background workers
import { ScoreUpdaterWorker } from "./workers/score-updater";
import { EventListenerWorker } from "./workers/event-listener";

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";

// Shared Prisma client (singleton across the process)
const prisma = new PrismaClient({
  log: NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

export function createApp(): Application {
  const app = express();

  // ---------------------------------------------------------------------------
  // Global middleware
  // ---------------------------------------------------------------------------
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestId);
  app.use(loggerMiddleware);
  app.use(apiRateLimit);

  // ---------------------------------------------------------------------------
  // Health check (no auth / rate-limit)
  // ---------------------------------------------------------------------------
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "@stellartrust/backend",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      env: NODE_ENV,
    });
  });

  // ---------------------------------------------------------------------------
  // API Routes — /api/v1
  // ---------------------------------------------------------------------------
  const api = express.Router();

  api.use("/auth", createAuthRouter());
  api.use("/identity", createIdentityRouter(prisma));
  api.use("/score", createScoreRouter(prisma));
  api.use("/attest", createAttestRouter(prisma));
  api.use("/webhooks", createWebhookRouter(prisma));
  api.use("/registry", createRegistryRouter(prisma));
  api.use("/lender", createLenderRouter(prisma));
  api.use("/contract", createContractRouter());

  app.use("/api/v1", api);

  // ---------------------------------------------------------------------------
  // 404 handler
  // ---------------------------------------------------------------------------
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // ---------------------------------------------------------------------------
  // Error handlers (must have 4 params for Express to treat as error middleware)
  // ---------------------------------------------------------------------------
  app.use(errorLogger);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: NODE_ENV === "development" ? err.message : "Internal server error",
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Startup (only when executed directly, not during tests)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Connect to Postgres
  await prisma.$connect();
  console.log("[Bootstrap] Postgres connected");

  const app = createApp();

  // Start background workers
  const scoreUpdater = new ScoreUpdaterWorker(prisma);
  const eventListener = new EventListenerWorker(prisma);

  scoreUpdater.start();
  await eventListener.start();

  // Start HTTP server
  const server = app.listen(PORT, () => {
    console.log(
      `[Bootstrap] StellarTrust backend listening on port ${PORT} (${NODE_ENV})`,
    );
    console.log(`[Bootstrap] API base: http://localhost:${PORT}/api/v1`);
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Bootstrap] Received ${signal} — shutting down gracefully`);
    server.close(async () => {
      scoreUpdater.stop();
      await eventListener.stop();
      await prisma.$disconnect();
      console.log("[Bootstrap] Shutdown complete");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error("[Bootstrap] Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error("[Bootstrap] Uncaught exception:", err);
    void shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[Bootstrap] Unhandled rejection:", reason);
  });
}

// Only auto-start when not required by tests
if (require.main === module) {
  main().catch((err) => {
    console.error("[Bootstrap] Fatal startup error:", err);
    process.exit(1);
  });
}
