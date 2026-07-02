.PHONY: build test lint fmt dev clean deploy-testnet deploy-mainnet

# ── Contracts ────────────────────────────────────────────────────────────────

contracts-build:
	cd contracts && cargo build --target wasm32-unknown-unknown --release

contracts-test:
	cd contracts && cargo test

contracts-fmt:
	cd contracts && cargo fmt --all

contracts-lint:
	cd contracts && cargo clippy --all-targets --all-features -- -D warnings

# ── Backend ──────────────────────────────────────────────────────────────────

backend-install:
	cd backend && npm ci

backend-dev:
	cd backend && npm run dev

backend-build:
	cd backend && npm run build

backend-test:
	cd backend && npm test

# ── Frontend ─────────────────────────────────────────────────────────────────

frontend-install:
	cd frontend && npm ci

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm test

# ── Composite targets ────────────────────────────────────────────────────────

build: contracts-build backend-build frontend-build

test: contracts-test backend-test frontend-test

lint: contracts-lint

fmt: contracts-fmt

dev:
	docker-compose up -d postgres redis ipfs
	$(MAKE) -j2 backend-dev frontend-dev

# ── Deployment ───────────────────────────────────────────────────────────────

deploy-testnet:
	cd contracts && make deploy-testnet

deploy-mainnet:
	cd contracts && make deploy-mainnet

# ── Database ─────────────────────────────────────────────────────────────────

db-migrate:
	cd backend && npm run db:migrate

db-generate:
	cd backend && npm run db:generate

# ── Docker ───────────────────────────────────────────────────────────────────

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

clean:
	cd contracts && cargo clean
	cd backend && rm -rf dist node_modules
	cd frontend && rm -rf .next node_modules
