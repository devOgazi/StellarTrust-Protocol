.PHONY: \
  build contracts-build backend-build frontend-build \
  test contracts-test backend-test frontend-test \
  test-integration contracts-test-integration backend-test-integration \
  lint contracts-lint backend-lint \
  fmt contracts-fmt \
  dev \
  db-migrate db-generate db-seed \
  deploy-testnet deploy-mainnet \
  docker-up docker-down docker-logs docker-build \
  install clean help

# ─────────────────────────────────────────────────────────────────────────────
# Top-level targets — these are what the README documents
# ─────────────────────────────────────────────────────────────────────────────

## build: Compile contracts (wasm), backend (tsc), and frontend (next build)
build: contracts-build backend-build frontend-build

## test: Run all unit-test suites (contracts + backend + frontend)
test: contracts-test backend-test frontend-test

## test-integration: Run integration tests (requires Postgres, Redis, local network)
test-integration: contracts-test-integration backend-test-integration

## lint: Run clippy on contracts and ESLint on backend
lint: contracts-lint backend-lint

## fmt: Auto-format all Rust and TypeScript source
fmt: contracts-fmt

## dev: Start backing services in Docker and run backend + frontend in watch mode
dev:
	docker-compose up -d postgres redis ipfs
	@echo "Waiting for services to be healthy..."
	@sleep 3
	$(MAKE) -j2 backend-dev frontend-dev

## deploy-testnet: Build and deploy all contracts to Stellar testnet
deploy-testnet:
	STELLAR_SECRET_KEY="$(STELLAR_SECRET_KEY)" \
	  bash scripts/deploy-contracts.sh testnet

## deploy-mainnet: Build and deploy all contracts to Stellar mainnet (requires key + governance)
deploy-mainnet:
	@echo "⚠️  Mainnet deployment requires governance approval and a 3-of-5 multisig."
	@echo "    Set STELLAR_SECRET_KEY to one of the authorised signers and confirm."
	@echo ""
	STELLAR_SECRET_KEY="$(STELLAR_SECRET_KEY)" \
	  NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015" \
	  bash scripts/deploy-contracts.sh mainnet

# ─────────────────────────────────────────────────────────────────────────────
# Contracts (Soroban / Rust)
# ─────────────────────────────────────────────────────────────────────────────

contracts-build:
	cd contracts && cargo build --target wasm32-unknown-unknown --release

contracts-test:
	cd contracts && cargo test

## contracts-test-integration: Run Rust integration-feature tests (needs local stellar network)
contracts-test-integration:
	cd contracts && cargo test --features integration

contracts-fmt:
	cd contracts && cargo fmt --all

contracts-lint:
	cd contracts && cargo clippy --all-targets --all-features -- -D warnings

# ─────────────────────────────────────────────────────────────────────────────
# Backend (Node.js / TypeScript)
# ─────────────────────────────────────────────────────────────────────────────

backend-install:
	cd backend && npm ci

backend-dev:
	cd backend && npm run dev

backend-build:
	cd backend && npm run build

backend-test:
	cd backend && npm test

backend-test-integration:
	cd backend && npm run test:integration

backend-lint:
	cd backend && npm run lint

# ─────────────────────────────────────────────────────────────────────────────
# Frontend (Next.js / TypeScript)
# ─────────────────────────────────────────────────────────────────────────────

frontend-install:
	cd frontend && npm ci

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm test

# ─────────────────────────────────────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────────────────────────────────────

## db-migrate: Apply pending Prisma migrations
db-migrate:
	bash scripts/migrate-db.sh

## db-generate: Regenerate Prisma client from schema
db-generate:
	cd backend && npm run db:generate

## db-seed: Seed initial trusted issuers into the backend DB
db-seed:
	cd backend && npx ts-node ../scripts/seed-issuers.ts

# ─────────────────────────────────────────────────────────────────────────────
# Docker helpers
# ─────────────────────────────────────────────────────────────────────────────

## docker-up: Start the full local stack in detached mode
docker-up:
	docker-compose up -d

## docker-down: Stop and remove containers (data volumes preserved)
docker-down:
	docker-compose down

## docker-logs: Tail all container logs
docker-logs:
	docker-compose logs -f

## docker-build: Rebuild Docker images without cache
docker-build:
	docker-compose build --no-cache

# ─────────────────────────────────────────────────────────────────────────────
# Install all dependencies
# ─────────────────────────────────────────────────────────────────────────────

install: backend-install frontend-install

# ─────────────────────────────────────────────────────────────────────────────
# Clean build artefacts
# ─────────────────────────────────────────────────────────────────────────────

clean:
	cd contracts && cargo clean
	cd backend  && rm -rf dist node_modules
	cd frontend && rm -rf .next node_modules

# ─────────────────────────────────────────────────────────────────────────────
# Help
# ─────────────────────────────────────────────────────────────────────────────

## help: Print this help message
help:
	@echo ""
	@echo "StellarTrust Protocol — Makefile targets"
	@echo "========================================="
	@grep -E '^##' Makefile | sed 's/## /  /'
	@echo ""
