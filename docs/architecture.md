# StellarTrust Protocol — Architecture

This document expands on the [Architecture section of the root README](../README.md#-architecture) with implementation-specific details for developers working on the protocol.

---

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Core Protocol Layers](#core-protocol-layers)
- [Component Interactions](#component-interactions)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Deployment Architecture](#deployment-architecture)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        StellarTrust Protocol                        │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────────────┐   │
│  │   Frontend   │    │   Backend   │    │  Soroban Contracts   │   │
│  │  (Next.js)  │◄──►│  (Node.js)  │◄──►│  (Rust / Soroban)   │   │
│  └─────────────┘    └─────────────┘    └──────────────────────┘   │
│         │                  │                      │                 │
│         │                  │              ┌───────┴──────┐         │
│         │                  │              │  Stellar Net  │         │
│         │                  │              │   (Mainnet /  │         │
│         │                  │              │   Testnet)    │         │
│         │                  │              └──────────────┘         │
│         │                  │                                        │
│         │           ┌──────┴──────┐                                │
│         │           │  Off-chain  │                                │
│         │           │  Storage    │                                │
│         │           │  (IPFS/     │                                │
│         └──────────►│  Arweave)   │                                │
│                     └─────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Protocol Layers

### Layer 0: Storage
- **IPFS (Kubo):** Off-chain credential payloads, encrypted with holder's public key
- **Arweave (future):** Permanent archival for critical identity documents

### Layer 1: Stellar Network
- **Soroban:** Smart contract runtime for identity, scoring, and registry contracts
- **Stellar Ledger:** Immutable blockchain storing contract state and transaction history
- **Horizon API:** RESTful interface for querying ledger history and account state
- **SEP Standards:** SEP-0010 (auth), SEP-0030 (recovery), SEP-0024 (deposit/withdrawal)

### Layer 2: Contract Layer
Rust-based Soroban smart contracts:
- **Identity Contract** (`contracts/identity/`): DID creation, credential storage, attestation management
- **Credit Score Contract** (`contracts/credit-score/`): Score computation, payment history, on-chain metrics
- **Registry Contract** (`contracts/registry/`): Trusted issuer whitelist, credential schema registry
- **Governance Contract** (`contracts/governance/`, Phase 2): On-chain voting, timelock enforcement

### Layer 3: Service Layer
Node.js/TypeScript backend services (`backend/src/services/`):
- **DID Resolver Service:** Resolves `did:stellar:<address>` to W3C DID Documents by querying Soroban + caching in Postgres
- **Score Engine Service:** Fetches on-chain scores, caches in Redis, persists snapshots to Postgres
- **Stellar Indexer Service:** Streams Soroban contract events from Horizon, indexes them for fast queries
- **IPFS Service:** Upload/retrieve credential payloads, pin critical documents
- **Attestation Service:** Issues signed attestations on behalf of registered issuers
- **KYC Bridge Service:** Integrates with Smile Identity, Sumsub, Jumio for KYC verification

Background workers:
- **Score Updater Worker:** Periodic recalculation of credit scores (every 6 hours)
- **Event Listener Worker:** Real-time Soroban event processing for identity/credential changes

### Layer 4: Application Layer
- **Frontend DApp** (`frontend/`): Next.js 14 App Router, Tailwind CSS, Freighter wallet integration
- **Lender SDK** (`sdk/`): TypeScript library for integrating identity + score verification into lending protocols
- **Mobile App** (Phase 2): React Native app for iOS/Android

---

## Component Interactions

### Identity Creation Flow

```
User → Frontend → Backend API → Identity Contract (Soroban)
                      ↓
                  Postgres (cache DID document)
```

1. User connects Freighter wallet (provides Stellar public key)
2. Frontend calls `POST /api/v1/identity/create` with address
3. Backend invokes `identity.create_did(owner)` on Soroban
4. Contract stores minimal DID metadata on-chain
5. Backend caches full W3C DID Document in Postgres for fast resolution
6. Frontend displays `did:stellar:<address>`

### Credential Issuance Flow

```
User → KYC Provider → Issuer Backend → Registry Contract (verify issuer)
                           ↓                ↓
                      IPFS (store)    Identity Contract (add_credential)
                           ↓                ↓
                      Backend DB      Postgres cache
```

1. User submits KYC documents to a trusted provider (Smile Identity, Sumsub)
2. KYC provider returns pass/fail + verification level
3. Issuer backend (registered in Registry contract) invokes `identity.add_credential()`
4. Full credential payload encrypted and stored on IPFS
5. Credential hash + IPFS CID stored on-chain in Identity contract
6. Backend DB updated for fast query access

### Credit Score Query Flow

```
Lender → Lender SDK → Score API → Redis (check cache)
                          ↓             ↓ (cache miss)
                      Postgres      Score Contract (Soroban)
                          ↓             ↓
                    Return score    Persist snapshot
```

1. Lender calls `client.lender.verify({ address, requiredScore: 650 })`
2. SDK hits `POST /api/v1/lender/verify`
3. Backend checks Redis cache (5-minute TTL)
4. On cache miss, query Soroban `score.get_score(subject)`
5. Persist snapshot to Postgres for history
6. Return score + rating + credential verification status

---

## Data Flow

### On-Chain Data (Soroban Storage)
Stored directly in contract state (Stellar ledger):
- DID ownership mapping (`address → DIDDocument`)
- Credential metadata (type, issuer, hash, expiry)
- Credit score components (payment history, transaction volume, etc.)
- Trusted issuer registry

### Off-Chain Data (Postgres)
Cached/indexed for performance:
- Full W3C DID Documents
- Credential records with IPFS CIDs
- Score snapshots (historical timeline)
- Issuer metadata
- Webhook events (Soroban event log)

### Off-Chain Data (IPFS)
Permanent, content-addressed storage:
- Encrypted credential payloads
- Supporting documents (KYC scans, proof of address, etc.)
- Credential schemas (JSON-LD)

### Ephemeral Data (Redis)
5-minute TTL cache:
- Credit score query results
- DID resolution results
- Rate-limit counters

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Contracts** | Rust, Soroban SDK | Smart contract logic |
| **Backend** | Node.js 20, TypeScript, Express | API server |
| **Database** | PostgreSQL 15, Prisma ORM | Relational data storage |
| **Cache** | Redis 7 | Fast key-value cache |
| **Frontend** | Next.js 14, React 18, Tailwind CSS | User interface |
| **Wallet Integration** | Freighter API, Rabet, Lobstr | Stellar wallet connectors |
| **Off-Chain Storage** | IPFS (Kubo 0.27) | Decentralized file storage |
| **Blockchain** | Stellar (Soroban testnet/mainnet) | Smart contract execution |
| **Build Tools** | Cargo, npm, Docker | Compilation & packaging |
| **CI/CD** | GitHub Actions | Automated testing & deployment |

---

## Deployment Architecture

### Development (`docker-compose.yml`)
Single-host Docker Compose stack:
- All services on `localhost`
- Postgres, Redis, IPFS, backend, frontend
- No TLS (HTTP only)

### Production (`docker-compose.prod.yml`)
Multi-service production stack with Nginx reverse proxy:
```
             ┌──────────────────┐
Internet ────┤  Nginx (TLS)     │
             └──────────────────┘
                │      │      │
      ┌─────────┼──────┼──────┼─────────┐
      │         │      │      │         │
   Frontend  Backend IPFS  Postgres  Redis
     :3000    :4000  :8080   :5432   :6379
```

- Nginx terminates TLS on port 443
- Routes `/api/` → backend, `/ipfs/` → IPFS gateway, `/` → frontend
- Backend + Postgres + Redis are not exposed to the public internet
- Docker images hosted on `ghcr.io/<org>/stellartrust-{backend,frontend}:latest`

### Testnet Deployment
Triggered by push to `develop` branch:
1. Run full test suite
2. Build + deploy Soroban contracts to Stellar testnet
3. Build + push Docker images to GHCR (`testnet` tag)
4. Capture contract IDs and inject into frontend build args

### Mainnet Deployment
Triggered by push to `main` branch (requires manual approval):
1. Security audit (cargo-audit, npm audit)
2. Manual approval gate (3 of 5 multisig signers)
3. Deploy contracts to Stellar mainnet
4. Build + push Docker images (`latest` tag)
5. Post-deployment summary in GitHub Actions

---

## Security Considerations

### Contract Security
- All contracts use `cargo clippy --deny warnings` (zero-warning policy)
- Input validation on every public function
- Reentrancy protection via Soroban's single-threaded execution model
- Access control: only Registry-whitelisted issuers can add credentials

### Backend Security
- SEP-0010 challenge-response auth for wallet-signed JWTs (optional for MVP)
- Rate limiting on all API routes (60 req/min default)
- PostgreSQL prepared statements (Prisma ORM prevents SQL injection)
- IPFS payloads encrypted with holder's public key (AES-256-GCM)
- Secrets stored in environment variables, never committed to Git

### Frontend Security
- No private keys stored in browser (Freighter extension handles signing)
- API calls use HTTPS in production
- Content Security Policy headers via Nginx
- No PII displayed in URLs or logs

---

## Performance Characteristics

| Operation | Latency | Notes |
|---|---|---|
| **Create DID** | 3–5s | Soroban transaction + 1 confirmation |
| **Add Credential** | 3–5s | On-chain write + IPFS upload (~1s) |
| **Resolve DID (cache hit)** | <50ms | Postgres query |
| **Resolve DID (cache miss)** | 500ms–1s | Soroban RPC call + cache write |
| **Get Score (cache hit)** | <50ms | Redis query |
| **Get Score (cache miss)** | 500ms–1s | Soroban RPC + Postgres write |
| **Lender Verify** | <100ms | Redis + Postgres (parallel) |

---

## Future Architecture Improvements (Roadmap)

- **Phase 2 (Q2–Q3 2026):** Governance contract, ZK-proof credential presentation
- **Phase 3 (Q4 2026):** Cross-chain identity bridges (Ethereum ↔ Stellar via Axelar)
- **Phase 4 (2027):** Decentralized oracle network for off-chain data (open banking APIs)

---

For questions or suggestions, open an issue or join our [Discord](https://discord.gg/stellartrust).
