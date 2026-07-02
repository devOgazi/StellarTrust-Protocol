//! Registry trust-check helpers used by the identity contract.
//!
//! In production the identity contract calls the deployed Registry contract
//! to verify issuer trust. Within the identity contract's own codebase (and
//! especially in unit tests) we use a lightweight in-contract trusted-issuer
//! allow-list stored under a well-known key so that tests can pre-register
//! issuers without deploying the full registry contract.

use soroban_sdk::{contracttype, Address, Env, Vec};

use stellartrust_shared::types::CredentialType;

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

/// Key under which the identity contract stores its local trusted-issuer list.
#[contracttype]
pub enum RegistryKey {
    TrustedIssuer(Address),
}

// ---------------------------------------------------------------------------
// Credential type filter — explicit enum avoids Option<T> in contracttype
// ---------------------------------------------------------------------------

/// Expresses which credential type(s) an issuer is trusted for.
///
/// `Option<CredentialType>` cannot be used directly inside a `#[contracttype]`
/// struct because Soroban's XDR codec requires all inner types to implement the
/// full set of conversion traits. Using an explicit enum is the idiomatic
/// Soroban workaround.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CredentialTypeFilter {
    /// The issuer is trusted for every credential type.
    Any,
    /// The issuer is trusted only for this specific credential type.
    Specific(CredentialType),
}

/// A record in the local trusted-issuer allow-list.
#[contracttype]
#[derive(Clone, Debug)]
pub struct TrustedIssuerEntry {
    pub issuer: Address,
    pub filter: CredentialTypeFilter,
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

/// Registers `issuer` as trusted for `credential_type`.
///
/// Pass `None` to trust the issuer for all credential types.
///
/// Stored in the contract's own persistent storage; in production this would
/// instead be a cross-contract call to the Registry contract.
pub fn register_trusted_issuer(
    env: &Env,
    issuer: Address,
    credential_type: Option<CredentialType>,
) {
    let filter = match credential_type {
        None => CredentialTypeFilter::Any,
        Some(ct) => CredentialTypeFilter::Specific(ct),
    };

    let key = RegistryKey::TrustedIssuer(issuer.clone());
    let mut entries: Vec<TrustedIssuerEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    entries.push_back(TrustedIssuerEntry {
        issuer,
        filter,
    });
    env.storage().persistent().set(&key, &entries);
}

// ---------------------------------------------------------------------------
// Trust checks
// ---------------------------------------------------------------------------

/// Returns `true` if `issuer` is trusted for the given `credential_type`.
pub fn is_trusted_issuer(
    env: &Env,
    issuer: &Address,
    credential_type: &CredentialType,
) -> bool {
    let key = RegistryKey::TrustedIssuer(issuer.clone());
    let entries: Vec<TrustedIssuerEntry> = match env.storage().persistent().get(&key) {
        Some(v) => v,
        None => return false,
    };
    for entry in entries.iter() {
        match &entry.filter {
            CredentialTypeFilter::Any => return true,
            CredentialTypeFilter::Specific(ct) if *ct == *credential_type => return true,
            _ => {}
        }
    }
    false
}

/// Returns `true` if `issuer` is trusted for at least one credential type.
/// Used by attestation, which is not tied to a specific type.
pub fn is_trusted_issuer_any(env: &Env, issuer: &Address) -> bool {
    let key = RegistryKey::TrustedIssuer(issuer.clone());
    env.storage().persistent().has(&key)
}
