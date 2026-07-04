//! Payment history tracking for the StellarTrust Credit Score contract.
//!
//! Loan repayments and defaults are recorded here. The `PaymentHistory` struct
//! is the primary input to the payment-history scoring component (35% weight).

use soroban_sdk::{contracttype, Address, Env, Vec};

use stellartrust_shared::types::Asset;

// ---------------------------------------------------------------------------
// Storage bump constants
// ---------------------------------------------------------------------------

const HISTORY_BUMP_LEDGERS: u32 = 6_307_200; // ~1 year
const HISTORY_BUMP_THRESHOLD: u32 = 518_400; // 30 days

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// A single loan repayment event, stored in the subject's history.
#[contracttype]
#[derive(Clone, Debug)]
pub struct RepaymentEvent {
    /// The lender's Stellar account address.
    pub lender: Address,
    /// Amount repaid in the asset's smallest unit (e.g. stroops for XLM).
    pub amount: i128,
    /// `true` if the payment was made on or before the due date.
    pub on_time: bool,
    /// The asset in which the repayment was made.
    pub asset: Asset,
    /// Unix timestamp (seconds) of the repayment ledger close.
    pub recorded_at: u64,
}

/// A single loan default event, stored in the subject's history.
#[contracttype]
#[derive(Clone, Debug)]
pub struct DefaultEvent {
    /// The lender's Stellar account address.
    pub lender: Address,
    /// Amount defaulted (outstanding principal) in the asset's smallest unit.
    pub amount: i128,
    /// The asset in which the loan was denominated.
    pub asset: Asset,
    /// Unix timestamp (seconds) when the default was recorded.
    pub recorded_at: u64,
}

/// Aggregated payment history for a subject.
///
/// Provides the summary statistics used by the scoring engine to compute the
/// `payment_history` component (35% of the total score).
#[contracttype]
#[derive(Clone, Debug)]
pub struct PaymentHistory {
    /// Total number of repayment events recorded.
    pub total_repayments: u32,
    /// Number of on-time repayments.
    pub on_time_repayments: u32,
    /// Number of late repayments.
    pub late_repayments: u32,
    /// Total number of default events recorded.
    pub total_defaults: u32,
    /// Unix timestamp of the most recent on-time repayment (0 = never).
    pub last_on_time_at: u64,
    /// Unix timestamp of the most recent default (0 = never).
    pub last_default_at: u64,
}

impl PaymentHistory {
    /// Returns an empty `PaymentHistory` for a subject with no history.
    pub fn empty() -> Self {
        PaymentHistory {
            total_repayments: 0,
            on_time_repayments: 0,
            late_repayments: 0,
            total_defaults: 0,
            last_on_time_at: 0,
            last_default_at: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/// Persistent storage keys for payment history data.
#[contracttype]
pub enum HistoryKey {
    /// Ordered list of repayment events for a subject.
    Repayments(Address),
    /// Ordered list of default events for a subject.
    Defaults(Address),
    /// Aggregated payment-history summary for a subject.
    Summary(Address),
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/// Records a loan repayment for `borrower`.
///
/// Updates both the raw repayment event list and the aggregated summary.
///
/// # Arguments
/// * `lender`   — the lender's address (must authorise the call at contract
///               level; not re-checked here).
/// * `borrower` — the subject whose history is updated.
/// * `amount`   — repayment amount in the asset's smallest unit.
/// * `on_time`  — `true` if the payment was on or before the due date.
/// * `asset`    — the repayment asset.
pub fn record_repayment(
    env: &Env,
    lender: Address,
    borrower: Address,
    amount: i128,
    on_time: bool,
    asset: Asset,
) {
    let now = env.ledger().timestamp();

    // Append raw event.
    let rep_key = HistoryKey::Repayments(borrower.clone());
    let mut repayments: Vec<RepaymentEvent> = env
        .storage()
        .persistent()
        .get(&rep_key)
        .unwrap_or_else(|| Vec::new(env));

    repayments.push_back(RepaymentEvent {
        lender,
        amount,
        on_time,
        asset,
        recorded_at: now,
    });
    env.storage().persistent().set(&rep_key, &repayments);
    env.storage()
        .persistent()
        .extend_ttl(&rep_key, HISTORY_BUMP_THRESHOLD, HISTORY_BUMP_LEDGERS);

    // Update aggregated summary.
    let sum_key = HistoryKey::Summary(borrower.clone());
    let mut summary: PaymentHistory = env
        .storage()
        .persistent()
        .get(&sum_key)
        .unwrap_or_else(PaymentHistory::empty);

    summary.total_repayments += 1;
    if on_time {
        summary.on_time_repayments += 1;
        summary.last_on_time_at = now;
    } else {
        summary.late_repayments += 1;
    }

    env.storage().persistent().set(&sum_key, &summary);
    env.storage()
        .persistent()
        .extend_ttl(&sum_key, HISTORY_BUMP_THRESHOLD, HISTORY_BUMP_LEDGERS);
}

/// Records a loan default for `borrower`.
///
/// Updates both the raw default event list and the aggregated summary.
pub fn record_default(env: &Env, lender: Address, borrower: Address, amount: i128, asset: Asset) {
    let now = env.ledger().timestamp();

    // Append raw event.
    let def_key = HistoryKey::Defaults(borrower.clone());
    let mut defaults: Vec<DefaultEvent> = env
        .storage()
        .persistent()
        .get(&def_key)
        .unwrap_or_else(|| Vec::new(env));

    defaults.push_back(DefaultEvent {
        lender,
        amount,
        asset,
        recorded_at: now,
    });
    env.storage().persistent().set(&def_key, &defaults);
    env.storage()
        .persistent()
        .extend_ttl(&def_key, HISTORY_BUMP_THRESHOLD, HISTORY_BUMP_LEDGERS);

    // Update aggregated summary.
    let sum_key = HistoryKey::Summary(borrower.clone());
    let mut summary: PaymentHistory = env
        .storage()
        .persistent()
        .get(&sum_key)
        .unwrap_or_else(PaymentHistory::empty);

    summary.total_defaults += 1;
    summary.last_default_at = now;

    env.storage().persistent().set(&sum_key, &summary);
    env.storage()
        .persistent()
        .extend_ttl(&sum_key, HISTORY_BUMP_THRESHOLD, HISTORY_BUMP_LEDGERS);
}

/// Returns the aggregated `PaymentHistory` for `subject`.
///
/// Returns an empty history if no records exist.
pub fn get_payment_history(env: &Env, subject: &Address) -> PaymentHistory {
    let sum_key = HistoryKey::Summary(subject.clone());
    env.storage()
        .persistent()
        .get(&sum_key)
        .unwrap_or_else(PaymentHistory::empty)
}
