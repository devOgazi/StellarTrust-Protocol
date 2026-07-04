//! On-chain metrics collection for the StellarTrust Credit Score contract.
//!
//! This module collects the on-chain behavioural signals used by the scoring
//! engine for the five non-payment-history score components:
//!
//! | Component              | Weight |
//! |------------------------|--------|
//! | transaction_volume     | 20 %   |
//! | account_longevity      | 15 %   |
//! | asset_diversity        | 10 %   |
//! | cross_border_activity  | 10 %   |
//! | credential_completeness| 10 %   |
//!
//! Metrics are written by the contract's public `record_*` functions and by
//! `compute_score`, which refreshes longevity from the current ledger timestamp.

use soroban_sdk::{contracttype, Address, Env};

// ---------------------------------------------------------------------------
// Storage bump constants
// ---------------------------------------------------------------------------

const METRICS_BUMP_LEDGERS: u32 = 6_307_200;
const METRICS_BUMP_THRESHOLD: u32 = 518_400;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// All on-chain behavioural metrics recorded for a subject.
///
/// Written incrementally as events occur and read atomically by the scoring
/// engine.
#[contracttype]
#[derive(Clone, Debug)]
pub struct SubjectMetrics {
    /// The subject these metrics belong to.
    pub subject: Address,

    // ---- Transaction volume -----------------------------------------------
    /// Cumulative inflow in XLM-equivalent stroops (approximation).
    pub total_inflow_stroops: i128,
    /// Cumulative outflow in XLM-equivalent stroops (approximation).
    pub total_outflow_stroops: i128,
    /// Total number of distinct payment operations recorded.
    pub transaction_count: u32,

    // ---- Account longevity ------------------------------------------------
    /// Unix timestamp (seconds) when the subject's Stellar account was first
    /// seen interacting with the protocol. Set on first `compute_score` or
    /// explicit `record_account_creation` call.
    pub account_created_at: u64,

    // ---- Asset diversity --------------------------------------------------
    /// Number of distinct asset types ever held or transacted by the subject.
    pub distinct_asset_count: u32,

    // ---- Cross-border activity --------------------------------------------
    /// Number of cross-border payment operations (path payments, anchor
    /// deposits/withdrawals) recorded.
    pub cross_border_tx_count: u32,
    /// Number of distinct payment corridors (currency-pair routes) used.
    pub cross_border_corridors: u32,

    // ---- Credential completeness ------------------------------------------
    /// Number of active (non-expired, non-revoked) verifiable credentials
    /// attached to the subject's DID at last score computation.
    pub credential_count: u32,
}

impl SubjectMetrics {
    /// Returns a zeroed `SubjectMetrics` for a subject with no prior data.
    pub fn empty(subject: Address, now: u64) -> Self {
        SubjectMetrics {
            subject,
            total_inflow_stroops: 0,
            total_outflow_stroops: 0,
            transaction_count: 0,
            account_created_at: now,
            distinct_asset_count: 0,
            cross_border_tx_count: 0,
            cross_border_corridors: 0,
            credential_count: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum MetricsKey {
    /// Subject metrics keyed by the subject's address.
    Metrics(Address),
}

// ---------------------------------------------------------------------------
// Public helper functions
// ---------------------------------------------------------------------------

/// Returns the stored `SubjectMetrics` for `subject`, creating an empty
/// record (with `account_created_at = now`) if none exists yet.
pub fn get_or_create_metrics(env: &Env, subject: &Address) -> SubjectMetrics {
    let key = MetricsKey::Metrics(subject.clone());
    match env.storage().persistent().get(&key) {
        Some(m) => m,
        None => SubjectMetrics::empty(subject.clone(), env.ledger().timestamp()),
    }
}

/// Persists `metrics` back to contract storage.
pub fn save_metrics(env: &Env, metrics: &SubjectMetrics) {
    let key = MetricsKey::Metrics(metrics.subject.clone());
    env.storage().persistent().set(&key, metrics);
    env.storage()
        .persistent()
        .extend_ttl(&key, METRICS_BUMP_THRESHOLD, METRICS_BUMP_LEDGERS);
}

/// Records a payment operation for the subject, updating transaction-volume
/// and asset-diversity metrics.
///
/// # Arguments
/// * `subject`       — the account whose metrics are updated.
/// * `inflow_stroops`  — amount received in this payment (0 if sender).
/// * `outflow_stroops` — amount sent in this payment (0 if receiver).
/// * `is_new_asset`  — `true` if this transaction involved an asset type not
///                     previously seen for this subject.
/// * `is_cross_border` — `true` if the payment crossed a currency boundary
///                       (e.g. a path-payment via the DEX).
/// * `new_corridor`  — `true` if this is a currency-pair corridor not
///                     previously used.
pub fn record_transaction(
    env: &Env,
    subject: &Address,
    inflow_stroops: i128,
    outflow_stroops: i128,
    is_new_asset: bool,
    is_cross_border: bool,
    new_corridor: bool,
) {
    let mut m = get_or_create_metrics(env, subject);
    m.total_inflow_stroops += inflow_stroops;
    m.total_outflow_stroops += outflow_stroops;
    m.transaction_count += 1;
    if is_new_asset {
        m.distinct_asset_count += 1;
    }
    if is_cross_border {
        m.cross_border_tx_count += 1;
        if new_corridor {
            m.cross_border_corridors += 1;
        }
    }
    save_metrics(env, &m);
}

/// Sets the `credential_count` on the subject's metrics record.
///
/// Called by `compute_score` after querying the identity contract (or
/// supplied directly in tests).
#[allow(dead_code)]
pub fn update_credential_count(env: &Env, subject: &Address, count: u32) {
    let mut m = get_or_create_metrics(env, subject);
    m.credential_count = count;
    save_metrics(env, &m);
}

// ---------------------------------------------------------------------------
// Score component computation helpers
// ---------------------------------------------------------------------------

/// Computes the raw `transaction_volume` sub-score (0–900).
///
/// Uses a logarithmic-ish tier table so that very high volumes don't dominate
/// the component:
///
/// | tx count | sub-score |
/// |----------|-----------|
/// | 0        | 0         |
/// | 1–4      | 150       |
/// | 5–19     | 300       |
/// | 20–49    | 500       |
/// | 50–99    | 650       |
/// | 100–249  | 750       |
/// | 250–499  | 820       |
/// | 500+     | 900       |
pub fn transaction_volume_subscore(tx_count: u32) -> u32 {
    match tx_count {
        0 => 0,
        1..=4 => 150,
        5..=19 => 300,
        20..=49 => 500,
        50..=99 => 650,
        100..=249 => 750,
        250..=499 => 820,
        _ => 900,
    }
}

/// Computes the raw `account_longevity` sub-score (0–900).
///
/// | account age (days) | sub-score |
/// |--------------------|-----------|
/// | 0                  | 0         |
/// | 1–29               | 100       |
/// | 30–89              | 250       |
/// | 90–179             | 400       |
/// | 180–364            | 550       |
/// | 365–729            | 700       |
/// | 730–1094           | 800       |
/// | 1095+              | 900       |
pub fn account_longevity_subscore(created_at: u64, now: u64) -> u32 {
    let age_days = if now > created_at {
        (now - created_at) / 86_400
    } else {
        0
    };
    match age_days {
        0 => 0,
        1..=29 => 100,
        30..=89 => 250,
        90..=179 => 400,
        180..=364 => 550,
        365..=729 => 700,
        730..=1094 => 800,
        _ => 900,
    }
}

/// Computes the raw `asset_diversity` sub-score (0–900).
///
/// | distinct assets | sub-score |
/// |-----------------|-----------|
/// | 0               | 0         |
/// | 1               | 200       |
/// | 2               | 400       |
/// | 3               | 600       |
/// | 4               | 750       |
/// | 5+              | 900       |
pub fn asset_diversity_subscore(distinct_assets: u32) -> u32 {
    match distinct_assets {
        0 => 0,
        1 => 200,
        2 => 400,
        3 => 600,
        4 => 750,
        _ => 900,
    }
}

/// Computes the raw `cross_border_activity` sub-score (0–900).
///
/// | cross-border txs | sub-score |
/// |------------------|-----------|
/// | 0                | 0         |
/// | 1–4              | 200       |
/// | 5–14             | 400       |
/// | 15–29            | 600       |
/// | 30–59            | 750       |
/// | 60+              | 900       |
pub fn cross_border_subscore(cb_tx_count: u32) -> u32 {
    match cb_tx_count {
        0 => 0,
        1..=4 => 200,
        5..=14 => 400,
        15..=29 => 600,
        30..=59 => 750,
        _ => 900,
    }
}

/// Computes the raw `credential_completeness` sub-score (0–900).
///
/// | credential count | sub-score |
/// |------------------|-----------|
/// | 0                | 0         |
/// | 1                | 300       |
/// | 2                | 500       |
/// | 3                | 650       |
/// | 4                | 800       |
/// | 5+               | 900       |
pub fn credential_completeness_subscore(credential_count: u32) -> u32 {
    match credential_count {
        0 => 0,
        1 => 300,
        2 => 500,
        3 => 650,
        4 => 800,
        _ => 900,
    }
}
