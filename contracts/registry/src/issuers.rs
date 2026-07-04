//! Trusted issuer management for the StellarTrust Registry contract.
//!
//! Issuers are entities authorised to issue verifiable credentials of specific
//! types on behalf of the protocol. The registry admin registers them; any
//! on-chain caller can query whether a given (issuer, credential_type) pair is
//! trusted.

use soroban_sdk::{contracttype, Address, Env, String, Vec};

use stellartrust_shared::types::CredentialType;

// ---------------------------------------------------------------------------
// Storage bump constants (mirrors identity contract)
// ---------------------------------------------------------------------------

/// Keep issuer records alive for ~1 year (at 5-second ledger close times).
const ISSUER_BUMP_LEDGERS: u32 = 6_307_200;
/// Extend TTL when fewer than 30 days of ledgers remain.
const ISSUER_BUMP_THRESHOLD: u32 = 518_400;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// Metadata about a trusted credential issuer stored in the registry.
///
/// All fields match the README's `IssuerMetadata` description.
#[contracttype]
#[derive(Clone, Debug)]
pub struct IssuerMetadata {
    /// Human-readable display name for the issuer organisation.
    pub name: String,
    /// Optional URL pointing to the issuer's DID document or website.
    pub url: String,
    /// Unix timestamp (seconds) when the issuer was registered.
    pub registered_at: u64,
    /// Whether the registration is currently active.
    pub active: bool,
}

/// Expresses which credential type(s) an issuer is authorised to issue.
///
/// `Option<CredentialType>` cannot appear inside a `#[contracttype]` struct,
/// so we model the "any type" case with an explicit enum variant.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum IssuerScope {
    /// The issuer is authorised for every credential type.
    Any,
    /// The issuer is authorised only for this specific credential type.
    Specific(CredentialType),
}

/// A complete issuer registration record stored in the registry.
#[contracttype]
#[derive(Clone, Debug)]
pub struct IssuerRecord {
    pub issuer: Address,
    pub metadata: IssuerMetadata,
    /// List of scopes for which the issuer is authorised.
    pub scopes: Vec<IssuerScope>,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/// Registry persistent storage keys for issuer data.
#[contracttype]
pub enum IssuerKey {
    /// Full issuer record keyed by the issuer's address.
    Issuer(Address),
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/// Registers (or re-registers) `issuer` as a trusted issuer with the given
/// `metadata` for the supplied `credential_types`.
///
/// * If `credential_types` is empty the issuer is trusted for **all** types
///   (equivalent to passing `IssuerScope::Any`).
/// * If `credential_types` is non-empty, exactly those types are added to the
///   issuer's scope list.
///
/// This function does **not** check that `admin` is authorised — authorisation
/// is enforced by the contract entry point (`lib.rs`) which calls
/// `admin.require_auth()` before delegating here.
pub fn register_issuer(
    env: &Env,
    issuer: Address,
    metadata: IssuerMetadata,
    credential_types: Vec<CredentialType>,
) {
    let key = IssuerKey::Issuer(issuer.clone());

    // Build scope list from the provided credential types.
    let mut scopes: Vec<IssuerScope> = Vec::new(env);
    if credential_types.is_empty() {
        scopes.push_back(IssuerScope::Any);
    } else {
        for ct in credential_types.iter() {
            scopes.push_back(IssuerScope::Specific(ct));
        }
    }

    let record = IssuerRecord {
        issuer,
        metadata,
        scopes,
    };

    env.storage().persistent().set(&key, &record);
    env.storage()
        .persistent()
        .extend_ttl(&key, ISSUER_BUMP_THRESHOLD, ISSUER_BUMP_LEDGERS);
}

/// Returns `true` if `issuer` is registered and trusted for `credential_type`.
///
/// An issuer with `IssuerScope::Any` is trusted for all types.
pub fn is_trusted_issuer(env: &Env, issuer: &Address, credential_type: &CredentialType) -> bool {
    let key = IssuerKey::Issuer(issuer.clone());
    let record: IssuerRecord = match env.storage().persistent().get(&key) {
        Some(r) => r,
        None => return false,
    };

    // An inactive registration is not trusted.
    if !record.metadata.active {
        return false;
    }

    for scope in record.scopes.iter() {
        match scope {
            IssuerScope::Any => return true,
            IssuerScope::Specific(ct) if ct == *credential_type => return true,
            _ => {}
        }
    }
    false
}

/// Returns `true` if `issuer` is registered and trusted for at least one
/// credential type. Used by the identity contract's `attest()` path, which is
/// not tied to a specific credential type.
pub fn is_trusted_issuer_any(env: &Env, issuer: &Address) -> bool {
    let key = IssuerKey::Issuer(issuer.clone());
    match env.storage().persistent().get::<IssuerKey, IssuerRecord>(&key) {
        Some(record) => record.metadata.active,
        None => false,
    }
}

/// Returns the full `IssuerRecord` for `issuer`, or `None` if not registered.
pub fn get_issuer(env: &Env, issuer: &Address) -> Option<IssuerRecord> {
    let key = IssuerKey::Issuer(issuer.clone());
    env.storage().persistent().get(&key)
}
