//! External data oracle interface for the StellarTrust Credit Score contract.
//!
//! In Phase 1, no live oracle integration is implemented (per spec). This
//! module defines the data structures that a future oracle integration would
//! populate, and a `OracleData` helper that the scoring engine accepts.
//!
//! When the oracle integration is built in a later phase, this module will be
//! extended with cross-contract call helpers to fetch off-chain data (open
//! banking income signals, cross-border corridor metrics, etc.).

use soroban_sdk::{contracttype, Address};

// ---------------------------------------------------------------------------
// Oracle data structures
// ---------------------------------------------------------------------------

/// External data signals that an oracle can supply for a subject address.
///
/// All fields are `Option` — they default to `None` when no oracle is
/// connected, allowing the scoring engine to degrade gracefully to on-chain
/// data only.
#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleData {
    /// Subject whose off-chain signals are captured here.
    pub subject: Address,

    /// Verified monthly income in microdollars (e.g. $1 000.00 → 1_000_000_000),
    /// provided by an open-banking oracle.
    pub verified_income_usd_micro: Option<i128>,

    /// Number of distinct Stellar payment corridors (currency pairs) the
    /// subject has used, as observed by an off-chain indexer.
    pub cross_border_corridors: Option<u32>,

    /// Debt-to-income ratio expressed as basis points (e.g. 3500 = 35.00 %).
    /// Provided by a lending-protocol oracle.
    pub debt_to_income_bps: Option<u32>,
}

impl OracleData {
    /// Returns a stub `OracleData` with no external signals for `subject`.
    ///
    /// Used when no oracle contract address is configured, ensuring the
    /// scoring algorithm continues to operate on on-chain data alone.
    pub fn empty(subject: Address) -> Self {
        OracleData {
            subject,
            verified_income_usd_micro: None,
            cross_border_corridors: None,
            debt_to_income_bps: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Oracle request / response types (for future cross-contract calls)
// ---------------------------------------------------------------------------

/// A request sent to an oracle contract asking for updated signals.
///
/// Not used in Phase 1 — included for API stability when the oracle
/// integration is implemented.
#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleRequest {
    /// The subject whose data is being requested.
    pub subject: Address,
    /// The ledger sequence number at which the request was submitted.
    pub request_ledger: u32,
}

/// The response returned by an oracle contract.
///
/// Not used in Phase 1 — included for API stability.
#[contracttype]
#[derive(Clone, Debug)]
pub struct OracleResponse {
    /// Echoes the original request.
    pub request: OracleRequest,
    /// The data payload (or an empty struct if unavailable).
    pub data: OracleData,
    /// Unix timestamp when the oracle fulfilled the request.
    pub fulfilled_at: u64,
}
