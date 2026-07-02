//! Protocol-wide constants for the StellarTrust Protocol.

/// Credit score floor — the minimum score any subject can hold.
pub const SCORE_MIN: u32 = 300;

/// Credit score ceiling — the maximum score any subject can hold.
pub const SCORE_MAX: u32 = 900;

/// DID method prefix used by the `did:stellar` method.
pub const DID_METHOD_PREFIX: &str = "did:stellar:";

/// Maximum number of credentials that can be attached to a single DID.
pub const MAX_CREDENTIALS_PER_DID: u32 = 64;

/// Maximum number of attestations that can be stored for a single subject.
pub const MAX_ATTESTATIONS_PER_SUBJECT: u32 = 128;

/// Storage bump amount (in ledgers) applied to DID document entries to keep
/// them alive between infrequent interactions (~1 year at 5-second ledgers).
pub const DID_STORAGE_BUMP_LEDGERS: u32 = 6_307_200;

/// Threshold ledger bump for triggering a storage extension (30 days).
pub const DID_STORAGE_BUMP_THRESHOLD: u32 = 518_400;
