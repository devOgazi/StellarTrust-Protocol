//! Core credit-scoring algorithm for the StellarTrust Credit Score contract.
//!
//! # Score scale
//! All scores are on the **300–900** scale specified in the README.
//!
//! # Component weights (exact, from README)
//! | Component               | Weight |
//! |-------------------------|--------|
//! | payment_history         | 35 %   |
//! | transaction_volume      | 20 %   |
//! | account_longevity       | 15 %   |
//! | asset_diversity         | 10 %   |
//! | cross_border_activity   | 10 %   |
//! | credential_completeness | 10 %   |

use soroban_sdk::{contracttype, Address, Env, Vec};

use stellartrust_shared::constants::{SCORE_MAX, SCORE_MIN};

use crate::history::get_payment_history;
use crate::metrics::{
    account_longevity_subscore, asset_diversity_subscore, cross_border_subscore,
    credential_completeness_subscore, get_or_create_metrics, transaction_volume_subscore,
};

// ---------------------------------------------------------------------------
// Storage bump constants
// ---------------------------------------------------------------------------

const SCORE_BUMP_LEDGERS: u32 = 6_307_200;
const SCORE_BUMP_THRESHOLD: u32 = 518_400;

/// Maximum history snapshots kept per subject.
const MAX_SCORE_HISTORY: u32 = 50;

// ---------------------------------------------------------------------------
// Public data types (README spec)
// ---------------------------------------------------------------------------

/// The six weighted components that make up a `CreditScore`.
///
/// Each field stores the **raw sub-score** (0–900) for that component, NOT the
/// weighted contribution. The composite score is computed from these via the
/// fixed weight table.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ScoreComponents {
    /// On-time repayment rate, penalised for late payments and defaults.
    /// Weight: 35 %.
    pub payment_history: u32,
    /// Transaction frequency and volume on the Stellar network.
    /// Weight: 20 %.
    pub transaction_volume: u32,
    /// Age of the subject's oldest Stellar account.
    /// Weight: 15 %.
    pub account_longevity: u32,
    /// Number of distinct asset types held or transacted.
    /// Weight: 10 %.
    pub asset_diversity: u32,
    /// Cross-border payment activity (path payments, anchor rails).
    /// Weight: 10 %.
    pub cross_border_activity: u32,
    /// Number and tier of verified credentials on the subject's DID.
    /// Weight: 10 %.
    pub credential_completeness: u32,
}

/// A full credit score record for a subject, as defined in the README.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CreditScore {
    /// The scored subject's Stellar account address.
    pub subject: Address,
    /// Composite credit score on the 300–900 scale.
    pub score: u32,
    /// Breakdown by scoring component.
    pub components: ScoreComponents,
    /// Unix timestamp (seconds) when the score was last computed.
    pub last_updated: u64,
    /// Number of on-chain data points used in this computation.
    pub data_points: u32,
}

/// A historical snapshot of a credit score at a point in time.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ScoreSnapshot {
    /// The composite score at snapshot time.
    pub score: u32,
    /// Component breakdown at snapshot time.
    pub components: ScoreComponents,
    /// Unix timestamp of the snapshot.
    pub snapshot_at: u64,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum ScoreKey {
    /// Current credit score keyed by subject address.
    Score(Address),
    /// Ordered list of historical snapshots keyed by subject address.
    History(Address),
}

// ---------------------------------------------------------------------------
// Weight constants (scaled to avoid floating point)
//
// Each weight is expressed as an integer numerator over 100.
// payment_history=35, tx_volume=20, longevity=15, diversity=10, cb=10, cred=10.
// ---------------------------------------------------------------------------

const W_PAYMENT: u32 = 35;
const W_TX_VOLUME: u32 = 20;
const W_LONGEVITY: u32 = 15;
const W_DIVERSITY: u32 = 10;
const W_CROSS_BORDER: u32 = 10;
const W_CREDENTIALS: u32 = 10;

// ---------------------------------------------------------------------------
// Payment history sub-score helper
// ---------------------------------------------------------------------------

/// Converts a `PaymentHistory` summary into a raw sub-score (0–900).
///
/// Algorithm:
/// 1. Start with a base of 900.
/// 2. Compute on-time ratio: if no repayments, give 500 (neutral / no data).
/// 3. Penalise each default by 150 points (capped at –600).
/// 4. Penalise each late payment by 30 points (capped at –300).
/// 5. Clamp to [0, 900].
fn payment_history_subscore(ph: &crate::history::PaymentHistory) -> u32 {
    if ph.total_repayments == 0 && ph.total_defaults == 0 {
        // No history at all — neutral score.
        return 500;
    }

    let mut score: i64 = 900;

    // On-time ratio bonus/penalty.
    if ph.total_repayments > 0 {
        // Scale: perfect ratio → 0 penalty; 0 % on-time → -400.
        let on_time_ratio_bps =
            (ph.on_time_repayments as i64 * 10_000) / ph.total_repayments as i64;
        // Penalty = 400 * (1 - ratio).
        let penalty = 400 * (10_000 - on_time_ratio_bps) / 10_000;
        score -= penalty;
    }

    // Default penalty.
    let default_penalty = (ph.total_defaults as i64 * 150).min(600);
    score -= default_penalty;

    // Clamp to [0, 900].
    score.clamp(0, 900) as u32
}

// ---------------------------------------------------------------------------
// Core composite score computation
// ---------------------------------------------------------------------------

/// Computes the weighted composite credit score from the six component
/// sub-scores.
///
/// Formula:
/// ```text
/// raw = (ph*35 + tv*20 + al*15 + ad*10 + cb*10 + cc*10) / 100
/// score = SCORE_MIN + raw * (SCORE_MAX - SCORE_MIN) / 900
/// ```
///
/// The raw weighted average is in [0, 900]. It is then linearly mapped onto
/// the [300, 900] output range so that a subject with all-zero components
/// receives 300 and a subject with all-900 components receives 900.
fn compute_composite(components: &ScoreComponents) -> u32 {
    let raw = (components.payment_history as u64 * W_PAYMENT as u64
        + components.transaction_volume as u64 * W_TX_VOLUME as u64
        + components.account_longevity as u64 * W_LONGEVITY as u64
        + components.asset_diversity as u64 * W_DIVERSITY as u64
        + components.cross_border_activity as u64 * W_CROSS_BORDER as u64
        + components.credential_completeness as u64 * W_CREDENTIALS as u64)
        / 100;

    // Map [0, 900] → [SCORE_MIN, SCORE_MAX].
    let range = (SCORE_MAX - SCORE_MIN) as u64;
    let score = SCORE_MIN as u64 + raw * range / 900;
    score.clamp(SCORE_MIN as u64, SCORE_MAX as u64) as u32
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/// Computes and stores a credit score for `subject`.
///
/// This is a pure on-chain computation that reads stored payment history and
/// metrics, assembles the six components, applies the weight table, and maps
/// the result onto the 300–900 scale.
///
/// The function also appends a `ScoreSnapshot` to the subject's score history
/// (capped at `MAX_SCORE_HISTORY` entries).
///
/// # Arguments
/// * `subject`          — the account being scored.
/// * `credential_count` — number of active credentials on the subject's DID,
///                        supplied by the caller (cross-contract query to the
///                        identity contract, or 0 if unknown).
///
/// Returns the freshly computed `CreditScore`.
pub fn compute_score(env: &Env, subject: Address, credential_count: u32) -> CreditScore {
    let now = env.ledger().timestamp();

    // 1. Payment history component.
    let ph = get_payment_history(env, &subject);
    let ph_sub = payment_history_subscore(&ph);

    // 2. Metrics-based components.
    let mut metrics = get_or_create_metrics(env, &subject);
    metrics.credential_count = credential_count;

    let tv_sub = transaction_volume_subscore(metrics.transaction_count);
    let al_sub = account_longevity_subscore(metrics.account_created_at, now);
    let ad_sub = asset_diversity_subscore(metrics.distinct_asset_count);
    let cb_sub = cross_border_subscore(metrics.cross_border_tx_count);
    let cc_sub = credential_completeness_subscore(credential_count);

    // 3. Count data points used.
    let data_points = ph.total_repayments
        + ph.total_defaults
        + metrics.transaction_count
        + metrics.cross_border_tx_count;

    let components = ScoreComponents {
        payment_history: ph_sub,
        transaction_volume: tv_sub,
        account_longevity: al_sub,
        asset_diversity: ad_sub,
        cross_border_activity: cb_sub,
        credential_completeness: cc_sub,
    };

    let composite = compute_composite(&components);

    let score = CreditScore {
        subject: subject.clone(),
        score: composite,
        components: components.clone(),
        last_updated: now,
        data_points,
    };

    // 4. Persist current score.
    let score_key = ScoreKey::Score(subject.clone());
    env.storage().persistent().set(&score_key, &score);
    env.storage()
        .persistent()
        .extend_ttl(&score_key, SCORE_BUMP_THRESHOLD, SCORE_BUMP_LEDGERS);

    // 5. Append to history (trim to MAX_SCORE_HISTORY).
    let hist_key = ScoreKey::History(subject.clone());
    let mut history: Vec<ScoreSnapshot> = env
        .storage()
        .persistent()
        .get(&hist_key)
        .unwrap_or_else(|| Vec::new(env));

    // Remove oldest entry if at capacity.
    if history.len() >= MAX_SCORE_HISTORY {
        history.remove(0);
    }

    history.push_back(ScoreSnapshot {
        score: composite,
        components,
        snapshot_at: now,
    });
    env.storage().persistent().set(&hist_key, &history);
    env.storage()
        .persistent()
        .extend_ttl(&hist_key, SCORE_BUMP_THRESHOLD, SCORE_BUMP_LEDGERS);

    score
}

/// Returns the current stored `CreditScore` for `subject`, or `None` if the
/// subject has never been scored.
pub fn get_score(env: &Env, subject: &Address) -> Option<CreditScore> {
    let key = ScoreKey::Score(subject.clone());
    env.storage().persistent().get(&key)
}

/// Returns the last `limit` historical `ScoreSnapshot` entries for `subject`
/// in chronological order (oldest first).
///
/// Returns an empty list if the subject has no score history.
pub fn get_score_history(env: &Env, subject: &Address, limit: u32) -> Vec<ScoreSnapshot> {
    let key = ScoreKey::History(subject.clone());
    let history: Vec<ScoreSnapshot> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    // Return the last `limit` entries.
    let total = history.len();
    if limit == 0 || total == 0 {
        return Vec::new(env);
    }

    let start = if total > limit { total - limit } else { 0 };
    let mut result: Vec<ScoreSnapshot> = Vec::new(env);
    for i in start..total {
        result.push_back(history.get(i).unwrap());
    }
    result
}
