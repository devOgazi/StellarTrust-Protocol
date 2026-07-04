//! StellarTrust Credit Score Contract — main entry point.
//!
//! Computes and stores on-chain credit scores for Stellar accounts based on
//! payment history and on-chain behavioural metrics.
//!
//! # Score scale
//! All scores use the **300–900** range specified in the README.
//!
//! # Public interface (matches README spec exactly)
//!
//! | Function            | Description                                          |
//! |---------------------|------------------------------------------------------|
//! | `compute_score`     | Compute and store a credit score for an address      |
//! | `record_repayment`  | Record a loan repayment event                        |
//! | `record_default`    | Record a loan default event                          |
//! | `get_score`         | Query the current score                              |
//! | `get_score_history` | Get score history (last N snapshots)                 |
//! | `record_transaction`| Record an on-chain transaction for metrics           |

#![no_std]

mod history;
mod metrics;
mod oracle;
mod score;

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

use stellartrust_shared::types::Asset;

use history::{record_default as do_record_default, record_repayment as do_record_repayment};
use metrics::record_transaction as do_record_transaction;
use score::{
    compute_score as do_compute_score, get_score as do_get_score,
    get_score_history as do_get_score_history, CreditScore, ScoreSnapshot,
};

// Re-export public types so external callers can reference them.
pub use oracle::{OracleData, OracleRequest, OracleResponse};
pub use score::{CreditScore as PublicCreditScore, ScoreComponents, ScoreSnapshot as PublicScoreSnapshot};

// ---------------------------------------------------------------------------
// Contract definition
// ---------------------------------------------------------------------------

#[contract]
pub struct CreditScoreContract;

#[contractimpl]
impl CreditScoreContract {
    // -----------------------------------------------------------------------
    // Score computation
    // -----------------------------------------------------------------------

    /// Computes and stores a credit score for `subject`.
    ///
    /// `credential_count` is the number of active verifiable credentials on
    /// the subject's DID, as supplied by the caller. In production this value
    /// is obtained via a cross-contract call to the Identity contract.
    ///
    /// Returns the newly computed `CreditScore`.
    pub fn compute_score(env: Env, subject: Address, credential_count: u32) -> CreditScore {
        do_compute_score(&env, subject, credential_count)
    }

    /// Returns the current stored `CreditScore` for `subject`, or `None` if
    /// the subject has never been scored.
    pub fn get_score(env: Env, subject: Address) -> Option<CreditScore> {
        do_get_score(&env, &subject)
    }

    /// Returns the last `limit` historical score snapshots for `subject` in
    /// chronological order (oldest first).
    pub fn get_score_history(
        env: Env,
        subject: Address,
        limit: u32,
    ) -> Vec<ScoreSnapshot> {
        do_get_score_history(&env, &subject, limit)
    }

    // -----------------------------------------------------------------------
    // Payment events
    // -----------------------------------------------------------------------

    /// Records a loan repayment for `borrower`.
    ///
    /// Requires the `lender` to authorise the call.
    pub fn record_repayment(
        env: Env,
        lender: Address,
        borrower: Address,
        amount: i128,
        on_time: bool,
        asset: Asset,
    ) {
        lender.require_auth();
        do_record_repayment(&env, lender, borrower, amount, on_time, asset);
    }

    /// Records a loan default for `borrower`.
    ///
    /// Requires the `lender` to authorise the call.
    pub fn record_default(
        env: Env,
        lender: Address,
        borrower: Address,
        amount: i128,
        asset: Asset,
    ) {
        lender.require_auth();
        do_record_default(&env, lender, borrower, amount, asset);
    }

    // -----------------------------------------------------------------------
    // Transaction metrics
    // -----------------------------------------------------------------------

    /// Records an on-chain transaction for the subject's metrics.
    ///
    /// Called by off-chain indexers or trusted oracle contracts to feed
    /// transaction-volume, asset-diversity, and cross-border metrics.
    pub fn record_transaction(
        env: Env,
        caller: Address,
        subject: Address,
        inflow_stroops: i128,
        outflow_stroops: i128,
        is_new_asset: bool,
        is_cross_border: bool,
        new_corridor: bool,
    ) {
        caller.require_auth();
        do_record_transaction(
            &env,
            &subject,
            inflow_stroops,
            outflow_stroops,
            is_new_asset,
            is_cross_border,
            new_corridor,
        );
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Env};
    use stellartrust_shared::types::Asset;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn setup() -> (Env, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(CreditScoreContract, ());
        (env, contract_id)
    }

    fn native_asset() -> Asset {
        Asset::Native
    }

    // -----------------------------------------------------------------------
    // Test 1: Score computation with a full data set
    // -----------------------------------------------------------------------

    /// A subject with rich on-chain data should score significantly above the
    /// 300 floor and approach the upper range.
    #[test]
    fn test_compute_score_full_dataset() {
        let (env, contract_id) = setup();
        let client = CreditScoreContractClient::new(&env, &contract_id);

        // Set a stable timestamp so longevity is deterministic.
        // 2 years of account age = 730 days → longevity sub-score 800.
        let two_years_ago: u64 = 1_000_000;
        let now: u64 = two_years_ago + 730 * 86_400;
        env.ledger().set_timestamp(now);

        let subject = Address::generate(&env);
        let lender = Address::generate(&env);

        // Seed account-creation timestamp by recording a transaction first.
        // We bypass the contract method and call record_transaction to seed
        // metrics with an explicit earlier timestamp.
        // Instead, set the ledger to `two_years_ago`, seed the metrics, then
        // advance back to `now`.

        env.ledger().set_timestamp(two_years_ago);
        // Record 200 transactions to reach the 100–249 bucket (sub-score 750).
        for _ in 0..200 {
            client.record_transaction(
                &lender,
                &subject,
                &1_000_000,
                &0,
                &true,  // each is a new asset (capped at distinct_asset_count)
                &false,
                &false,
            );
        }

        // Record 20 on-time repayments and 0 defaults.
        for _ in 0..20 {
            client.record_repayment(&lender, &subject, &1_000_000, &true, &native_asset());
        }

        // Advance to `now`.
        env.ledger().set_timestamp(now);

        // Compute score with 4 credentials.
        let score = client.compute_score(&subject, &4u32);

        // Composite must be in [300, 900].
        assert!(score.score >= 300 && score.score <= 900, "score out of range: {}", score.score);

        // With 20/20 on-time repayments payment_history component should be 900.
        assert_eq!(score.components.payment_history, 900);

        // With 200 txs transaction_volume component should be 750.
        assert_eq!(score.components.transaction_volume, 750);

        // With 4 credentials credential_completeness should be 800.
        assert_eq!(score.components.credential_completeness, 800);

        // data_points should include repayments + transactions.
        assert!(score.data_points >= 20);

        // Score should be well above the floor given the rich data.
        assert!(score.score > 500, "expected score > 500, got {}", score.score);
    }

    // -----------------------------------------------------------------------
    // Test 2: Score computation with sparse / missing data
    // -----------------------------------------------------------------------

    /// A brand-new subject with no history should receive a score at or just
    /// above the 300 floor.
    #[test]
    fn test_compute_score_sparse_data() {
        let (env, contract_id) = setup();
        let client = CreditScoreContractClient::new(&env, &contract_id);

        env.ledger().set_timestamp(1_000_000);
        let subject = Address::generate(&env);

        // No repayments, no transactions, 0 credentials.
        let score = client.compute_score(&subject, &0u32);

        assert!(score.score >= 300 && score.score <= 900, "score out of range: {}", score.score);

        // With no data, payment_history defaults to 500 (neutral) and all
        // other components are 0.
        assert_eq!(score.components.payment_history, 500);
        assert_eq!(score.components.transaction_volume, 0);
        assert_eq!(score.components.account_longevity, 0);
        assert_eq!(score.components.asset_diversity, 0);
        assert_eq!(score.components.cross_border_activity, 0);
        assert_eq!(score.components.credential_completeness, 0);

        // Sparse subject should be near the floor (only payment_history=500
        // contributes; all others are 0).
        // Composite = (500*35 + 0) / 100 = 175; mapped: 300 + 175*600/900 = 416.
        assert!(score.score <= 450, "sparse score too high: {}", score.score);
    }

    // -----------------------------------------------------------------------
    // Test 3: Repayment recording affects payment_history weight
    // -----------------------------------------------------------------------

    #[test]
    fn test_repayment_affects_payment_history() {
        let (env, contract_id) = setup();
        let client = CreditScoreContractClient::new(&env, &contract_id);

        env.ledger().set_timestamp(1_000_000);
        let subject = Address::generate(&env);
        let lender = Address::generate(&env);

        // Compute baseline score with no history.
        let baseline = client.compute_score(&subject, &0u32);
        assert_eq!(baseline.components.payment_history, 500); // neutral

        // Record 5 on-time + 0 late → perfect ratio → sub-score 900.
        for _ in 0..5 {
            client.record_repayment(&lender, &subject, &500_000, &true, &native_asset());
        }
        let after_good = client.compute_score(&subject, &0u32);
        assert_eq!(after_good.components.payment_history, 900);
        assert!(after_good.score > baseline.score, "good repayments should raise score");

        // Record 5 late payments → ratio drops to 50 % → penalty applied.
        for _ in 0..5 {
            client.record_repayment(&lender, &subject, &500_000, &false, &native_asset());
        }
        let after_late = client.compute_score(&subject, &0u32);
        assert!(
            after_late.components.payment_history < 900,
            "late payments should reduce payment_history component"
        );
        assert!(
            after_late.score < after_good.score,
            "late payments should reduce overall score"
        );

        // Record a default → further penalty.
        client.record_default(&lender, &subject, &1_000_000, &native_asset());
        let after_default = client.compute_score(&subject, &0u32);
        assert!(
            after_default.components.payment_history < after_late.components.payment_history,
            "default should reduce payment_history below late-payment level"
        );
        assert!(
            after_default.score < after_late.score,
            "default should reduce overall score below late-payment level"
        );
    }

    // -----------------------------------------------------------------------
    // Test 4: get_score returns None before first compute
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_score_returns_none_before_compute() {
        let (env, contract_id) = setup();
        let client = CreditScoreContractClient::new(&env, &contract_id);

        let subject = Address::generate(&env);
        let result = client.get_score(&subject);
        assert!(result.is_none(), "expected None before first compute");
    }

    // -----------------------------------------------------------------------
    // Test 5: Score history grows with each compute call
    // -----------------------------------------------------------------------

    #[test]
    fn test_score_history_grows() {
        let (env, contract_id) = setup();
        let client = CreditScoreContractClient::new(&env, &contract_id);

        env.ledger().set_timestamp(1_000_000);
        let subject = Address::generate(&env);

        client.compute_score(&subject, &0u32);
        client.compute_score(&subject, &1u32);
        client.compute_score(&subject, &2u32);

        let history = client.get_score_history(&subject, &10u32);
        assert_eq!(history.len(), 3, "expected 3 history snapshots");
    }

    // -----------------------------------------------------------------------
    // Test 6: Composite score stays within [300, 900] under extreme inputs
    // -----------------------------------------------------------------------

    #[test]
    fn test_score_stays_within_bounds() {
        let (env, contract_id) = setup();
        let client = CreditScoreContractClient::new(&env, &contract_id);

        let subject = Address::generate(&env);
        let lender = Address::generate(&env);

        // Seed metrics at time 0 so account_created_at = 0.
        env.ledger().set_timestamp(0);
        client.record_transaction(&lender, &subject, &1_000_000, &500_000, &true, &true, &true);

        // Advance to 4+ years later so longevity sub-score is maximised (1095+ days).
        let four_years_secs: u64 = 4 * 365 * 86_400;
        env.ledger().set_timestamp(four_years_secs);

        // Max out all components with 500 transactions (tx_count bucket 500+ → 900).
        for _ in 0..499 {
            client.record_transaction(&lender, &subject, &1_000_000, &500_000, &true, &true, &true);
        }
        // 50 on-time repayments → payment_history 900.
        for _ in 0..50 {
            client.record_repayment(&lender, &subject, &1_000_000, &true, &native_asset());
        }

        // 10 credentials → credential_completeness 900.
        let score = client.compute_score(&subject, &10u32);
        assert_eq!(score.score, 900, "all-max inputs should produce score 900, got {}", score.score);

        // A fresh subject right at genesis should sit at the floor.
        let env2 = Env::default();
        env2.mock_all_auths();
        let contract_id2 = env2.register(CreditScoreContract, ());
        let client2 = CreditScoreContractClient::new(&env2, &contract_id2);
        env2.ledger().set_timestamp(0);
        let poor_subject = Address::generate(&env2);
        // 5 defaults, no repayments.
        let rich_lender = Address::generate(&env2);
        for _ in 0..5 {
            client2.record_default(&rich_lender, &poor_subject, &1_000_000, &native_asset());
        }
        let low_score = client2.compute_score(&poor_subject, &0u32);
        assert!(
            low_score.score >= 300 && low_score.score <= 900,
            "score must stay in [300, 900], got {}",
            low_score.score
        );
    }
}
