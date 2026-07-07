# Credit Scoring Model

This document expands on the [Credit Scoring Model section of the root README](../README.md#-credit-scoring-model) with implementation details for the Soroban score contract and the backend `ScoreEngineService`.

---

## Table of Contents

- [Score Scale](#score-scale)
- [Scoring Factors](#scoring-factors)
- [Component Computation](#component-computation)
- [Implementation: Score Contract](#implementation-score-contract)
- [Implementation: Score Engine Service](#implementation-score-engine-service)
- [Data Sources](#data-sources)
- [Score Lifecycle](#score-lifecycle)
- [Caching and History](#caching-and-history)

---

## Score Scale

Scores are on a **300 – 900** scale, mirroring the FICO range familiar to institutional lenders.

| Score Range | Rating | Description |
|---|---|---|
| 800 – 900 | Exceptional | Highest creditworthiness, lowest risk |
| 740 – 799 | Very Good | Above-average financial behavior |
| 670 – 739 | Good | Near or slightly above average |
| 580 – 669 | Fair | Below average; some risk factors present |
| 300 – 579 | Poor | Limited history or significant negative events |

---

## Scoring Factors

Six components are weighted to produce the composite score:

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

### Rust type (contracts/credit-score/src/score.rs)

```rust
pub struct ScoreComponents {
    pub payment_history: u32,           // 35% weight — sub-score 0–1000
    pub account_longevity: u32,         // 15% weight — sub-score 0–1000
    pub transaction_volume: u32,        // 20% weight — sub-score 0–1000
    pub asset_diversity: u32,           // 10% weight — sub-score 0–1000
    pub cross_border_activity: u32,     // 10% weight — sub-score 0–1000
    pub credential_completeness: u32,   // 10% weight — sub-score 0–1000
}
```

Each component produces a sub-score on a **0 – 1000** internal scale. The composite score is then:

```
composite = 300 + (
  paymentHistory        * 0.35 +
  transactionVolume     * 0.20 +
  accountLongevity      * 0.15 +
  assetDiversity        * 0.10 +
  crossBorderActivity   * 0.10 +
  credentialCompleteness* 0.10
) * 0.60   // maps 0–1000 sub-scores to 0–600 range → total 300–900
```

---

## Component Computation

### Payment History (35%)

Source: `score.record_repayment()` and `score.record_default()` events written by registered lenders.

Algorithm (implemented in `contracts/credit-score/src/history.rs`):
- Each on-time repayment increments a running "good payment" counter
- Each late payment or default decrements the counter with a weighted penalty
- Recency bias: events in the last 12 months have 2× weight vs older events
- Starting base score for accounts with no history: 500 (neutral)

### Transaction Volume (20%)

Source: Stellar Horizon payment operations on the account.

Factors:
- Total USD-equivalent value transacted over account lifetime
- Regularity coefficient (consistent monthly activity vs. sporadic bursts)
- Inflow/outflow balance ratio (positive net flow is favorable)

The `StellarIndexerService` (`backend/src/services/stellar-indexer.ts`) streams Horizon events and normalises XLM/USDC/EURC amounts into a USD baseline using the Stellar DEX USDC/XLM price at the time of each operation.

### Account Longevity (15%)

Source: Stellar account creation timestamp (Horizon `accounts` endpoint).

Factors:
- Age of the primary account in months
- If multiple sub-accounts: average age weighted by balance
- Consecutive months with at least one transaction (penalises dormant accounts)

### Asset Diversity (10%)

Source: Account trustlines and DEX participation via Horizon.

Factors:
- Number of distinct non-XLM assets held (trustlines)
- Participation in Stellar DEX (path payment operations)
- Liquidity pool deposits/withdrawals
- Maximum contribution: 8+ distinct assets = maximum diversity sub-score

### Cross-Border Activity (10%)

Source: Stellar path payment operations and cross-border payment corridors.

Factors:
- Number of distinct destination countries (inferred from anchor identifiers in asset codes)
- Path payment operations per month (XLM/USDC cross-border rails)
- Corridor diversity: sending/receiving across multiple corridors is rewarded

### Credential Completeness (10%)

Source: Active (non-revoked, non-expired) credentials in the Identity contract.

Tiers:
| Credentials Present | Sub-score |
|---|---|
| None | 0 |
| KYCBasic only | 300 |
| KYCVerified | 550 |
| KYCVerified + ProofOfAddress | 700 |
| KYCVerified + ProofOfAddress + one more | 850 |
| KYCVerified + ProofOfAddress + two or more | 1000 |

---

## Implementation: Score Contract

Source: `contracts/credit-score/src/`

| File | Responsibility |
|---|---|
| `lib.rs` | Contract entry point; `compute_score`, `get_score`, `record_repayment`, `record_default`, `get_score_history` |
| `score.rs` | Core weighted scoring algorithm; maps sub-scores to 300–900 range |
| `metrics.rs` | Reads on-chain metrics: transaction volume, account longevity, asset diversity |
| `history.rs` | Manages payment history ring buffer; applies recency weighting |
| `oracle.rs` | External data oracle interface for off-chain data (Phase 2) |

### Key Functions

```rust
// Compute and persist a new score snapshot
fn compute_score(env: Env, subject: Address) -> CreditScore;

// Return the latest stored score (no recomputation)
fn get_score(env: Env, subject: Address) -> Option<CreditScore>;

// Record a loan repayment event (called by registered lenders)
fn record_repayment(env, lender, borrower, amount, on_time, asset);

// Record a default event
fn record_default(env, lender, borrower, amount, asset);

// Return last N score snapshots
fn get_score_history(env: Env, subject: Address, limit: u32) -> Vec<ScoreSnapshot>;
```

---

## Implementation: Score Engine Service

Source: `backend/src/services/score-engine.ts`

The `ScoreEngineService` acts as an off-chain caching and aggregation layer:

1. **Redis cache (TTL: 5 min):** All `getScore()` calls check Redis first using key `score:<address>`
2. **On-chain read (Soroban RPC):** On cache miss, calls `score.get_score(subject)` if contract ID is configured
3. **Postgres fallback:** If Soroban is unreachable, serves the most recent `ScoreSnapshot` from the DB
4. **Snapshot persistence:** Every on-chain fetch persists a row to `ScoreSnapshot` for history tracking
5. **Credit report assembly:** `getCreditReport()` combines current score + history + active credentials

### TypeScript types (matching the backend API response)

```typescript
interface ScoreComponents {
  paymentHistory: number;        // 35%
  transactionVolume: number;     // 20%
  accountLongevity: number;      // 15%
  assetDiversity: number;        // 10%
  crossBorderActivity: number;   // 10%
  credentialCompleteness: number;// 10%
}

interface CreditScore {
  subject: string;
  score: number;          // 300–900
  rating: string;         // "Exceptional" | "Very Good" | "Good" | "Fair" | "Poor"
  components: ScoreComponents;
  dataPoints: number;     // number of on-chain events used
  lastUpdated: string;    // ISO-8601 timestamp
}
```

---

## Data Sources

| Component | On-Chain Source | Off-Chain Source |
|---|---|---|
| Payment History | `score.record_repayment/default()` events | Indexed by `EventListenerWorker` |
| Transaction Volume | Horizon payment operations | `StellarIndexerService` |
| Account Longevity | Stellar account creation date | Horizon `accounts` endpoint |
| Asset Diversity | Account trustlines | Horizon `accounts` endpoint |
| Cross-Border Activity | Path payment operations | `StellarIndexerService` |
| Credential Completeness | Identity contract credentials | Backend Postgres cache |

---

## Score Lifecycle

```
1. Initial score: computed on first call to compute_score()
   (or score = 0 / no data if account too new)

2. Passive updates: StellarIndexerService detects new on-chain events
   (payments, pathPayments, new trustlines) → triggers background recompute

3. Active updates: lenders call record_repayment() / record_default()
   on the Score contract → ScoreUpdaterWorker triggers recompute

4. Periodic recompute: ScoreUpdaterWorker runs every 6 hours for
   all accounts with activity in the last 24 hours

5. Cache invalidation: every successful recompute deletes the
   Redis key, ensuring the next query fetches the fresh score
```

---

## Caching and History

**Redis (ephemeral, 5-minute TTL):**
- Key: `score:<stellar_address>`
- Value: JSON-serialized `CreditScore` object
- Invalidated on: score update, explicit `invalidateCache()` call

**Postgres `ScoreSnapshot` table:**
- One row per score computation event
- Fields: address, score, all 6 component values, dataPoints, snapshotAt
- Supports: score history timeline, trend analysis, audit trail
- Indexed on: `(address)`, `(address, snapshotAt)`

**Score history API:** `GET /api/v1/score/:address/history?limit=20&offset=0`
- Returns up to 100 snapshots (default 20)
- Ordered by `snapshotAt DESC`
- Each entry includes: `score`, `rating`, `components`, `dataPoints`, `snapshotAt`
