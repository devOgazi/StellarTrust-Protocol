# 🌟 StellarTrust Protocol

> **Decentralized Identity & Credit Scoring Infrastructure on Stellar**  
> Open, permissionless, and verifiable financial reputation — for everyone.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stellar Network](https://img.shields.io/badge/Network-Stellar-7B2D8B)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Contracts-Soroban-FF6B35)](https://soroban.stellar.org)
[![Built with Rust](https://img.shields.io/badge/Contracts-Rust-orange)](https://www.rust-lang.org/)
[![TypeScript](https://img.shields.io/badge/Frontend-TypeScript-3178C6)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [Our Solution](#-our-solution)
- [Architecture](#-architecture)
- [Repository Structure](#-repository-structure)
- [Smart Contracts (Soroban)](#-smart-contracts-soroban)
- [Backend Services](#-backend-services)
- [Frontend Application](#-frontend-application)
- [Protocol Flow](#-protocol-flow)
- [Credit Scoring Model](#-credit-scoring-model)
- [Identity System (DID)](#-identity-system-did)
- [Getting Started](#-getting-started)
- [Environment Configuration](#-environment-configuration)
- [Deployment](#-deployment)
- [API Reference](#-api-reference)
- [Testing](#-testing)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌍 Overview

**StellarTrust** is a fully decentralized protocol that enables **self-sovereign identity** and **on-chain credit scoring** for individuals and businesses — without relying on centralized credit bureaus, banks, or identity providers.

Built on **Stellar's Soroban smart contract platform**, StellarTrust leverages Stellar's:
- Sub-cent transaction fees (~$0.00001/tx)
- 3–5 second finality
- Native USDC and stablecoin rails
- Existing SEP standards (SEP-0010 auth, SEP-0030 recovery)
- Global reach in underbanked markets

StellarTrust is particularly designed for **emerging market users** — the 1.4 billion adults worldwide who are credit-invisible, unable to prove financial identity, or excluded from formal financial systems.

---

## 🔴 The Problem

### Identity
- 1 billion+ people globally lack formal, verifiable identity
- Centralized identity providers are privacy-invasive single points of failure
- KYC/AML compliance is expensive and excludes lower-income users
- Cross-border identity portability is virtually nonexistent

### Credit Scoring
- Traditional credit bureaus (Experian, TransUnion, Equifax) have no global presence
- Scoring is opaque, unfair, and often racially/geographically biased
- Billions lack a "credit history" despite years of reliable on-chain financial behavior
- Lending protocols require collateral > loan value, defeating the purpose for underbanked users

---

## ✅ Our Solution

StellarTrust solves both problems simultaneously:

| Component | What it does |
|---|---|
| **DID Module** | Issues self-sovereign identity anchored to a Stellar keypair |
| **Credential Registry** | Stores verifiable credentials (KYC, education, employment) on-chain |
| **Score Engine** | Computes a transparent, algorithmic credit score from on-chain behavior |
| **Attestation Network** | Allows trusted issuers to vouch for identity attributes |
| **Privacy Layer** | ZK-proof-ready credential presentation (no unnecessary data disclosure) |
| **Lender SDK** | Plug-and-play SDK for lenders to query scores and verify identity |

---

## 🏗 Architecture

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

### Core Protocol Layers

```
Layer 4: Application Layer     [Frontend DApp, Lender SDK, Mobile App]
Layer 3: Service Layer         [Score API, DID Resolver, Attestation Indexer]
Layer 2: Contract Layer        [Identity Contract, Score Contract, Registry]
Layer 1: Stellar Network       [Soroban, Ledger, SEP Standards, Horizon API]
Layer 0: Storage               [IPFS for credentials, Arweave for permanence]
```

---

## 📁 Repository Structure

```
stellartrust/
│
├── contracts/                          # Soroban smart contracts (Rust)
│   ├── identity/                       # DID & identity management contract
│   │   ├── src/
│   │   │   ├── lib.rs                  # Main contract entry point
│   │   │   ├── did.rs                  # DID creation & management
│   │   │   ├── credentials.rs          # Verifiable credential storage
│   │   │   ├── attestation.rs          # Issuer attestation logic
│   │   │   └── errors.rs               # Custom error types
│   │   ├── Cargo.toml
│   │   └── README.md
│   │
│   ├── credit-score/                   # Credit scoring engine contract
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── score.rs                # Core scoring algorithm
│   │   │   ├── metrics.rs              # On-chain metrics collection
│   │   │   ├── history.rs              # Payment history tracking
│   │   │   └── oracle.rs               # External data oracle interface
│   │   ├── Cargo.toml
│   │   └── README.md
│   │
│   ├── registry/                       # Issuer & schema registry
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── issuers.rs              # Trusted issuer management
│   │   │   └── schemas.rs              # Credential schema registry
│   │   ├── Cargo.toml
│   │   └── README.md
│   │
│   ├── governance/                     # Protocol governance contract
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── proposals.rs
│   │   │   └── voting.rs
│   │   ├── Cargo.toml
│   │   └── README.md
│   │
│   └── shared/                         # Shared types and utilities
│       ├── src/
│       │   ├── lib.rs
│       │   ├── types.rs
│       │   └── constants.rs
│       └── Cargo.toml
│
├── backend/                            # Node.js / TypeScript backend services
│   ├── src/
│   │   ├── api/                        # REST API routes
│   │   │   ├── identity.ts             # Identity endpoints
│   │   │   ├── score.ts                # Score query endpoints
│   │   │   ├── credentials.ts          # Credential management
│   │   │   └── webhooks.ts             # Webhook handlers
│   │   │
│   │   ├── services/                   # Business logic
│   │   │   ├── did-resolver.ts         # DID document resolution
│   │   │   ├── score-engine.ts         # Off-chain score computation assist
│   │   │   ├── stellar-indexer.ts      # Stellar horizon event indexer
│   │   │   ├── ipfs.ts                 # IPFS credential storage
│   │   │   ├── attestation.ts          # Credential attestation service
│   │   │   └── kyc-bridge.ts           # KYC provider integration bridge
│   │   │
│   │   ├── workers/                    # Background processing
│   │   │   ├── score-updater.ts        # Periodic score recalculation
│   │   │   └── event-listener.ts       # Real-time Soroban event listener
│   │   │
│   │   ├── models/                     # Database models (PostgreSQL)
│   │   │   ├── identity.model.ts
│   │   │   ├── credential.model.ts
│   │   │   ├── score-snapshot.model.ts
│   │   │   └── issuer.model.ts
│   │   │
│   │   ├── middleware/                 # Express middleware
│   │   │   ├── auth.ts                 # SEP-0010 JWT auth middleware
│   │   │   ├── ratelimit.ts
│   │   │   └── logger.ts
│   │   │
│   │   └── utils/
│   │       ├── stellar.ts              # Stellar SDK helpers
│   │       └── crypto.ts               # Cryptographic utilities
│   │
│   ├── prisma/
│   │   └── schema.prisma               # Database schema
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/                           # Next.js frontend application
│   ├── src/
│   │   ├── app/                        # Next.js App Router
│   │   │   ├── page.tsx                # Landing page
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # User dashboard
│   │   │   ├── identity/
│   │   │   │   ├── create/page.tsx     # DID creation flow
│   │   │   │   └── manage/page.tsx     # Credential management
│   │   │   ├── score/
│   │   │   │   └── page.tsx            # Credit score overview
│   │   │   ├── lender/
│   │   │   │   └── page.tsx            # Lender verification portal
│   │   │   └── governance/
│   │   │       └── page.tsx            # Protocol governance UI
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                     # Base UI components (shadcn/ui)
│   │   │   ├── identity/               # Identity-specific components
│   │   │   ├── score/                  # Score display components
│   │   │   ├── wallet/                 # Stellar wallet integration
│   │   │   └── layout/                 # Layout components
│   │   │
│   │   ├── hooks/
│   │   │   ├── useStellarWallet.ts     # Wallet connection hook
│   │   │   ├── useDID.ts               # DID operations hook
│   │   │   ├── useCreditScore.ts       # Score query hook
│   │   │   └── useContracts.ts         # Soroban contract interaction
│   │   │
│   │   ├── lib/
│   │   │   ├── stellar.ts              # Stellar SDK client setup
│   │   │   ├── soroban.ts              # Soroban contract clients
│   │   │   └── api.ts                  # API client
│   │   │
│   │   └── types/
│   │       └── index.ts                # Shared TypeScript types
│   │
│   ├── public/
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
│
├── sdk/                                # Lender / Developer SDK
│   ├── src/
│   │   ├── index.ts                    # SDK entry point
│   │   ├── identity-client.ts          # Identity verification client
│   │   ├── score-client.ts             # Credit score query client
│   │   └── types.ts
│   ├── package.json
│   └── README.md
│
├── docs/                               # Protocol documentation
│   ├── architecture.md
│   ├── did-spec.md                     # DID method specification
│   ├── scoring-model.md                # Credit scoring model docs
│   ├── api-reference.md
│   └── integration-guide.md
│
├── scripts/                            # Deployment & utility scripts
│   ├── deploy-contracts.sh
│   ├── seed-issuers.ts
│   └── migrate-db.sh
│
├── .github/
│   └── workflows/
│       ├── test.yml
│       ├── deploy-testnet.yml
│       └── deploy-mainnet.yml
│
├── docker-compose.yml
├── docker-compose.prod.yml
├── Makefile
└── README.md                           # ← You are here
```

---

## 📜 Smart Contracts (Soroban)

All contracts are written in **Rust** and deployed to **Stellar's Soroban** smart contract platform.

### 1. Identity Contract (`contracts/identity/`)

Manages decentralized identities (DIDs) anchored to Stellar keypairs.

**Key Functions:**

```rust
// Create a new DID for a Stellar account
fn create_did(env: Env, owner: Address) -> DID;

// Add a verifiable credential to an identity
fn add_credential(
    env: Env,
    owner: Address,
    credential_type: CredentialType,
    issuer: Address,
    credential_hash: BytesN<32>,
    expiry: Option<u64>
) -> CredentialId;

// Revoke a credential
fn revoke_credential(env: Env, issuer: Address, credential_id: CredentialId);

// Resolve a DID document
fn resolve_did(env: Env, owner: Address) -> DIDDocument;

// Add an attestation from a trusted issuer
fn attest(
    env: Env,
    issuer: Address,
    subject: Address,
    claim: AttestationClaim
);
```

**Data Structures:**

```rust
pub struct DIDDocument {
    pub did: String,                          // did:stellar:<account_id>
    pub controller: Address,
    pub verification_methods: Vec<VerificationMethod>,
    pub credentials: Vec<CredentialRef>,
    pub created_at: u64,
    pub updated_at: u64,
}

pub enum CredentialType {
    KYCBasic,
    KYCVerified,
    ProofOfAddress,
    EmploymentVerification,
    IncomeVerification,
    EducationCertificate,
    BusinessRegistration,
    Custom(String),
}
```

---

### 2. Credit Score Contract (`contracts/credit-score/`)

Computes and stores credit scores based on on-chain Stellar history.

**Key Functions:**

```rust
// Compute and store a credit score for an address
fn compute_score(env: Env, subject: Address) -> CreditScore;

// Record a loan repayment event
fn record_repayment(
    env: Env,
    lender: Address,
    borrower: Address,
    amount: i128,
    on_time: bool,
    asset: Asset,
);

// Record a loan default
fn record_default(
    env: Env,
    lender: Address,
    borrower: Address,
    amount: i128,
    asset: Asset,
);

// Query current score
fn get_score(env: Env, subject: Address) -> Option<CreditScore>;

// Get score history (last N snapshots)
fn get_score_history(env: Env, subject: Address, limit: u32) -> Vec<ScoreSnapshot>;
```

**Score Breakdown:**

```rust
pub struct CreditScore {
    pub subject: Address,
    pub score: u32,                           // 300–900 scale
    pub components: ScoreComponents,
    pub last_updated: u64,
    pub data_points: u32,
}

pub struct ScoreComponents {
    pub payment_history: u32,                 // 35% weight
    pub account_longevity: u32,               // 15% weight
    pub transaction_volume: u32,              // 20% weight
    pub asset_diversity: u32,                 // 10% weight
    pub cross_border_activity: u32,           // 10% weight
    pub credential_completeness: u32,         // 10% weight
}
```

---

### 3. Registry Contract (`contracts/registry/`)

Manages trusted issuers and credential schemas.

**Key Functions:**

```rust
// Register a new trusted credential issuer
fn register_issuer(
    env: Env,
    admin: Address,
    issuer: Address,
    issuer_metadata: IssuerMetadata,
    credential_types: Vec<CredentialType>,
);

// Check if an issuer is trusted for a credential type
fn is_trusted_issuer(
    env: Env,
    issuer: Address,
    credential_type: CredentialType,
) -> bool;

// Register a credential schema
fn register_schema(env: Env, schema: CredentialSchema) -> SchemaId;
```

---

### 4. Governance Contract (`contracts/governance/`)

Enables protocol parameter changes through token-weighted governance.

**Key Functions:**

```rust
// Create a governance proposal
fn create_proposal(
    env: Env,
    proposer: Address,
    proposal_type: ProposalType,
    description: String,
    calldata: Bytes,
) -> ProposalId;

// Vote on a proposal
fn vote(env: Env, voter: Address, proposal_id: ProposalId, support: bool);

// Execute a passed proposal
fn execute(env: Env, proposal_id: ProposalId);
```

---

### Building & Testing Contracts

```bash
# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Build all contracts
cd contracts
make build

# Run contract unit tests
make test

# Run contract integration tests (requires local Stellar network)
make test-integration

# Deploy to Stellar testnet
make deploy-testnet

# Deploy to Stellar mainnet
make deploy-mainnet NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
```

---

## 🖥 Backend Services

The backend is a **Node.js / TypeScript** application using Express.js, Prisma ORM (PostgreSQL), and Redis for caching.

### Services

| Service | Description |
|---|---|
| `DIDResolverService` | Resolves `did:stellar:<id>` to a full DID document |
| `ScoreEngineService` | Assists off-chain score computation and caches results |
| `StellarIndexerService` | Streams Soroban events from Horizon and indexes them |
| `IPFSService` | Stores and retrieves credential payloads on IPFS |
| `AttestationService` | Manages the attestation issuance pipeline |
| `KYCBridgeService` | Integrations with Smile Identity, Sumsub, Jumio |

### Key API Endpoints

```
GET    /api/v1/identity/:address          # Resolve DID document
POST   /api/v1/identity/create            # Create new DID
POST   /api/v1/identity/credential        # Add credential
DELETE /api/v1/identity/credential/:id    # Revoke credential

GET    /api/v1/score/:address             # Get credit score
GET    /api/v1/score/:address/history     # Score history
GET    /api/v1/score/:address/report      # Full credit report

POST   /api/v1/attest                     # Issue attestation (issuers only)
GET    /api/v1/registry/issuers           # List trusted issuers
GET    /api/v1/registry/schemas           # List credential schemas

POST   /api/v1/lender/verify              # Lender identity & score verification
```

### Running the Backend

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Start production server
npm run build && npm run start

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

---

## 🎨 Frontend Application

Built with **Next.js 14** (App Router), **Tailwind CSS**, and **shadcn/ui**. Wallet integration via **@stellar/freighter-api** and **rabet**.

### Pages & Features

| Route | Description |
|---|---|
| `/` | Landing page — protocol overview |
| `/dashboard` | User dashboard — identity + score overview |
| `/identity/create` | Step-by-step DID creation wizard |
| `/identity/manage` | Add/view/revoke credentials |
| `/score` | Credit score visualization, history, and breakdown |
| `/lender` | Lender portal — verify identity and query scores |
| `/governance` | Governance proposals and voting |

### Wallet Support

StellarTrust supports the following Stellar wallets:

- **Freighter** (browser extension) — primary
- **Rabet** (browser extension)
- **Lobstr** (mobile + web)
- **xBull Wallet**
- **WalletConnect** (Stellar-compatible wallets)

### Running the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local
# Configure NEXT_PUBLIC_ variables

# Start development server
npm run dev          # http://localhost:3000

# Build for production
npm run build
npm run start

# Run component tests
npm run test

# Run E2E tests (requires running backend + Stellar testnet)
npm run test:e2e
```

---

## 🔄 Protocol Flow

### 1. Identity Creation

```
User                  Frontend              Backend              Soroban Contract
 │                       │                     │                      │
 │  Connect wallet        │                     │                      │
 │──────────────────────►│                     │                      │
 │                        │  POST /identity/create                    │
 │                        │────────────────────►│                     │
 │                        │                     │  invokeContract()   │
 │                        │                     │────────────────────►│
 │                        │                     │  ◄─ DIDDocument     │
 │  DID: did:stellar:G... │◄────────────────────│                     │
 │◄───────────────────────│                     │                     │
```

### 2. Credential Issuance (e.g. KYC)

```
User              KYC Provider           Issuer Backend         Identity Contract
 │                     │                      │                       │
 │  Submit KYC docs     │                      │                       │
 │────────────────────►│                      │                       │
 │                      │  KYC Result: PASS    │                       │
 │                      │─────────────────────►│                       │
 │                      │                      │  add_credential()     │
 │                      │                      │──────────────────────►│
 │                      │                      │                       │ Store credential hash
 │  Credential issued   │                      │                       │ on-chain
 │◄─────────────────────────────────────────── │                       │
```

### 3. Credit Score Query (Lender Flow)

```
Lender             Lender SDK            Score API           Score Contract
 │                     │                     │                     │
 │  getTrustScore(addr) │                     │                     │
 │────────────────────►│                     │                     │
 │                      │  GET /score/:addr    │                     │
 │                      │────────────────────►│                     │
 │                      │                     │  get_score()        │
 │                      │                     │────────────────────►│
 │                      │                     │◄── CreditScore      │
 │                      │◄────────────────────│                     │
 │◄─────────────────────│                     │                     │
 │  { score: 742,       │                     │                     │
 │    verified: true,   │                     │                     │
 │    credentials: [...]}                     │                     │
```

---

## 📊 Credit Scoring Model

### Score Scale: 300 – 900

| Score Range | Rating | Description |
|---|---|---|
| 800 – 900 | Exceptional | Highly creditworthy, lowest risk |
| 740 – 799 | Very Good | Above average creditworthiness |
| 670 – 739 | Good | Near or slightly above average |
| 580 – 669 | Fair | Below average, some risk factors |
| 300 – 579 | Poor | Significant risk, limited credit history |

### Scoring Factors

```
┌─────────────────────────────────────────────────────────┐
│              Credit Score Component Weights             │
├─────────────────────────────────────────────────────────┤
│  Payment History          ████████████████████  35%    │
│  Transaction Volume       ████████████          20%    │
│  Account Longevity        ████████              15%    │
│  Asset Diversity          ██████                10%    │
│  Cross-Border Activity    ██████                10%    │
│  Credential Completeness  ██████                10%    │
└─────────────────────────────────────────────────────────┘
```

**Payment History (35%):** On-time vs. late loan repayments, delinquencies, defaults, and recency of negative events.

**Transaction Volume (20%):** Total value transacted over time, regularity of activity, and inflow/outflow ratios.

**Account Longevity (15%):** Age of oldest Stellar account, average age of all accounts, length of credit relationships.

**Asset Diversity (10%):** Number of distinct asset types held (XLM, USDC, EURC, native assets), DEX participation, liquidity positions.

**Cross-Border Activity (10%):** Stellar-native cross-border payment behavior, pathPayment operations, corridor diversity.

**Credential Completeness (10%):** Number and quality of verified credentials (KYC tier, proof of address, employment, etc.).

---

## 🆔 Identity System (DID)

StellarTrust implements the **`did:stellar` DID method**, anchoring decentralized identifiers to Stellar account keypairs.

### DID Format

```
did:stellar:<stellar_account_id>

Example:
did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ
```

### DID Document Structure

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://stellartrust.io/contexts/v1"
  ],
  "id": "did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ",
  "controller": "did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ",
  "verificationMethod": [
    {
      "id": "did:stellar:GAHT...#primary",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:stellar:GAHT...",
      "publicKeyMultibase": "zGAHT..."
    }
  ],
  "authentication": ["did:stellar:GAHT...#primary"],
  "service": [
    {
      "id": "did:stellar:GAHT...#credit-score",
      "type": "CreditScoreService",
      "serviceEndpoint": "https://api.stellartrust.io/score/GAHT..."
    }
  ],
  "credentials": [
    {
      "id": "cred:0x4a3b...",
      "type": "KYCVerified",
      "issuer": "did:stellar:GCK3...",
      "issuedAt": 1717200000,
      "expiresAt": 1748736000,
      "credentialHash": "0x4a3b..."
    }
  ]
}
```

### Credential Privacy

Sensitive credential data is **never stored on-chain**. StellarTrust stores only:
- Credential type
- Issuer address
- Issuance/expiry timestamps
- IPFS CID (for off-chain payload, if present)
- SHA-256 hash of the credential payload (for verifiability)

The full credential payload lives on **IPFS** and is encrypted with the user's public key. Only the holder can decrypt and selectively disclose attributes to verifiers.

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Rust | 1.75+ | Soroban smart contracts |
| `stellar-cli` | latest | Contract deployment & testing |
| Node.js | 20.x LTS | Backend & frontend |
| PostgreSQL | 15+ | Backend database |
| Redis | 7+ | Caching & job queues |
| Docker | 24+ | Local development stack |
| IPFS (Kubo) | 0.27+ | Off-chain credential storage |

### Quick Start (Docker)

```bash
# Clone the repository
git clone https://github.com/your-org/stellartrust.git
cd stellartrust

# Copy all environment configs
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Start the full stack (contracts assumed deployed to testnet)
docker-compose up -d

# Verify services
docker-compose ps

# Access the app
# Frontend:       http://localhost:3000
# Backend API:    http://localhost:4000
# API Docs:       http://localhost:4000/docs
# IPFS Gateway:   http://localhost:8080
```

### Manual Setup

```bash
# 1. Clone repo
git clone https://github.com/your-org/stellartrust.git
cd stellartrust

# 2. Build & deploy contracts to testnet
cd contracts
cargo build --target wasm32-unknown-unknown --release
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/identity.wasm \
  --source <YOUR_TESTNET_KEY> --network testnet

# 3. Set up backend
cd ../backend
npm install
cp .env.example .env
# Edit .env with contract addresses from step 2
npm run db:migrate
npm run dev

# 4. Set up frontend
cd ../frontend
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev
```

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/stellartrust

# Redis
REDIS_URL=redis://localhost:6379

# Stellar
STELLAR_NETWORK=testnet                           # testnet | mainnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Contract Addresses (from deployment)
IDENTITY_CONTRACT_ID=C...
SCORE_CONTRACT_ID=C...
REGISTRY_CONTRACT_ID=C...

# IPFS
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080

# KYC Provider (choose one or multiple)
SMILE_IDENTITY_API_KEY=
SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=7d

# Encryption
CREDENTIAL_ENCRYPTION_KEY=32-byte-hex-key
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_IPFS_GATEWAY=http://localhost:8080

# Contract IDs
NEXT_PUBLIC_IDENTITY_CONTRACT_ID=C...
NEXT_PUBLIC_SCORE_CONTRACT_ID=C...
NEXT_PUBLIC_REGISTRY_CONTRACT_ID=C...
```

---

## 🚢 Deployment

### Stellar Testnet (CI/CD)

```bash
# Automated via GitHub Actions on push to `develop`
# See .github/workflows/deploy-testnet.yml

# Manual testnet deploy
make deploy-testnet
```

### Stellar Mainnet

```bash
# Requires manual approval via GitHub Actions (push to `main`)
# See .github/workflows/deploy-mainnet.yml

# Manual mainnet deploy
STELLAR_SECRET_KEY=<COLD_WALLET_KEY> make deploy-mainnet
```

### Contract Upgrade Policy

All contract upgrades on mainnet must:
1. Pass governance vote (>50% token quorum)
2. Survive a 48-hour timelock after vote passes
3. Pass automated security audit checks
4. Be signed by 3-of-5 protocol multisig keys

---

## 📡 API Reference

Full OpenAPI specification available at `/docs` when running the backend locally, or at [https://api.stellartrust.io/docs](https://api.stellartrust.io/docs).

### Developer SDK (Quick Example)

```typescript
import { StellarTrust } from '@stellartrust/sdk';

const client = new StellarTrust({
  network: 'mainnet',
  apiKey: 'your-api-key',   // optional — rate limits apply without
});

// Resolve a DID
const identity = await client.identity.resolve(
  'GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ'
);

// Get credit score (lender flow)
const score = await client.score.get(address);
console.log(score);
// {
//   score: 742,
//   rating: "Very Good",
//   lastUpdated: "2025-06-15T12:00:00Z",
//   components: { paymentHistory: 780, accountLongevity: 710, ... },
//   verifiedCredentials: ["KYCVerified", "ProofOfAddress"],
//   dataPoints: 1247
// }

// Verify identity + score together
const verification = await client.lender.verify({
  address,
  requiredScore: 650,
  requiredCredentials: ['KYCVerified'],
});
// { approved: true, score: 742, credentialsVerified: true }
```

---

## 🧪 Testing

### Contract Tests

```bash
cd contracts

# Unit tests
cargo test

# Integration tests (requires Stellar local network)
stellar network start local
cargo test --features integration

# Coverage report
cargo tarpaulin --out Html
```

### Backend Tests

```bash
cd backend

# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (requires PostgreSQL & Redis)
npm run test:integration

# E2E API tests
npm run test:e2e

# Coverage
npm run test:coverage
```

### Frontend Tests

```bash
cd frontend

# Component tests (Vitest)
npm test

# E2E tests (Playwright)
npm run test:e2e

# Visual regression tests
npm run test:visual
```

---

## 🔒 Security

### Threat Model

StellarTrust has been designed with the following adversarial assumptions:
- Malicious contract callers attempting to inflate scores
- Compromised issuers issuing fraudulent credentials
- Privacy attacks attempting to de-anonymize credential holders
- Replay attacks on signed credential presentations

### Key Security Properties

- **Non-repudiation:** All credentials are cryptographically signed by issuers
- **Tamper evidence:** Credential hashes are stored on-chain; any tampering is detectable
- **Issuer authorization:** Only registry-whitelisted issuers can add credentials to a DID
- **Score integrity:** Score computations are deterministic and fully verifiable on-chain
- **Privacy by default:** No PII is stored on-chain; only hashes and IPFS CIDs

### Audits

| Audit Firm | Scope | Date | Report |
|---|---|---|---|
| *Pending* | Soroban Contracts | Q3 2025 | TBD |
| *Pending* | Backend API | Q3 2025 | TBD |

### Responsible Disclosure

Found a vulnerability? Please email **security@stellartrust.io**.  
Do **not** open a public GitHub issue for security vulnerabilities.  
We offer a bug bounty program — details at [stellartrust.io/security](https://stellartrust.io/security).

---

## 🗺 Roadmap

### Phase 1 — Foundation ✅ (Q1 2026)
- [x] Core identity contract (DID creation, credential storage)
- [x] Credit score contract (payment history, account metrics)
- [x] Issuer registry contract
- [x] Backend API (identity resolution, score queries)
- [x] Frontend MVP (dashboard, score display)
- [x] Testnet deployment

### Phase 2 — Ecosystem (Q2–Q3 2026)
- [ ] Governance contract + token
- [ ] KYC provider integrations (Smile Identity, Sumsub)
- [ ] Lender SDK v1.0
- [ ] Mobile app (React Native)
- [ ] ZK-proof credential presentation
- [ ] Mainnet launch

### Phase 3 — Scale (Q4 2026)
- [ ] Cross-chain identity bridges (EVM ↔ Stellar)
- [ ] Income verification oracle (open banking APIs)
- [ ] DAO governance transition
- [ ] Institutional lender partnerships
- [ ] ISO/IEC 29115 compliance alignment

---

## 🤝 Contributing

We welcome contributions from developers, researchers, and domain experts.

### Development Workflow

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/stellartrust.git

# Create a feature branch
git checkout -b feature/my-feature

# Make your changes, write tests
# Commit with conventional commits
git commit -m "feat(contracts): add credential expiry extension function"

# Push and open a PR
git push origin feature/my-feature
```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope):    new feature
fix(scope):     bug fix
docs(scope):    documentation only
test(scope):    test additions
refactor(scope): code change without feature/fix
chore(scope):   maintenance
```

### Code Standards

- **Rust contracts:** `cargo fmt` + `cargo clippy` (zero warnings policy)
- **TypeScript:** ESLint + Prettier (configs in repo)
- **Tests required:** PRs must maintain or improve test coverage
- **Documentation:** All public functions must have docstrings

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

The StellarTrust name and logo are trademarks of StellarTrust Labs.  
Protocol usage is permissionless; the brand is not.

---

## 🙏 Acknowledgements

- [Stellar Development Foundation](https://stellar.org) — for building Soroban and the Stellar network
- [W3C DID Working Group](https://www.w3.org/TR/did-core/) — for the DID specification
- [Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/) — W3C VC standard
- The Stellar developer community for SEP standards and tooling

---

<div align="center">

**Built for the 1.4 billion who deserve financial identity.**

[Website](https://stellartrust.io) · [Docs](https://docs.stellartrust.io) · [Discord](https://discord.gg/stellartrust) · [Twitter](https://twitter.com/stellartrust)

</div>
