//! Registry trust-check helpers used by the identity contract.
//!
//! Supports two modes:
//!
//! 1. **In-contract allow-list** (legacy / test mode): trusted issuers are
//!    stored directly in the identity contract's own persistent storage via
//!    `register_trusted_issuer`. Used in unit tests and when no external
//!    registry contract address has been configured.
//!
//! 2. **Cross-contract registry call** (production mode): when a registry
//!    contract address has been stored via `set_registry_contract`, trust
//!    checks delegate to the deployed `RegistryContract` via
//!    `soroban_sdk::invoke_contract`. This enforces the README's "Issuer
//!    authorization" security property through the standalone registry.

use soroban_sdk::{contracttype, Address, Env, IntoVal, Symbol, Vec};

use stellartrust_shared::types::CredentialType;

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/// Key under which the identity contract stores its local trusted-issuer list.
#[contracttype]
pub enum RegistryKey {
    TrustedIssuer(Address),
    /// Address of the external Registry contract, if configured.
    RegistryContract,
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
// Registry contract address management
// ---------------------------------------------------------------------------

/// Stores the address of the deployed Registry contract so that trust checks
/// can be delegated to it.
///
/// Once set, `is_trusted_issuer` and `is_trusted_issuer_any` will cross-call
/// the registry contract in preference to the local allow-list.
pub fn set_registry_contract(env: &Env, registry: Address) {
    env.storage()
        .instance()
        .set(&RegistryKey::RegistryContract, &registry);
}

/// Returns the configured Registry contract address, or `None` if not set.
pub fn get_registry_contract(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get(&RegistryKey::RegistryContract)
}

// ---------------------------------------------------------------------------
// Admin helpers (in-contract allow-list)
// ---------------------------------------------------------------------------

/// Registers `issuer` as trusted for `credential_type` in the in-contract
/// allow-list.
///
/// Pass `None` to trust the issuer for all credential types.
///
/// This is the legacy path used in unit tests and in the identity contract's
/// own `register_issuer` admin function.
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
///
/// Resolution order:
/// 1. If a Registry contract address is configured, cross-call
///    `RegistryContract::is_trusted_issuer(issuer, credential_type)`.
/// 2. Otherwise, check the local in-contract allow-list.
pub fn is_trusted_issuer(
    env: &Env,
    issuer: &Address,
    credential_type: &CredentialType,
) -> bool {
    if let Some(registry_addr) = get_registry_contract(env) {
        // Cross-contract call to the Registry contract.
        let result: bool = env.invoke_contract(
            &registry_addr,
            &Symbol::new(env, "is_trusted_issuer"),
            (issuer.clone(), credential_type.clone()).into_val(env),
        );
        return result;
    }

    // Fallback: in-contract allow-list.
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
///
/// Resolution order:
/// 1. If a Registry contract address is configured, cross-call
///    `RegistryContract::is_trusted_issuer_any(issuer)`.
/// 2. Otherwise, check the local in-contract allow-list.
pub fn is_trusted_issuer_any(env: &Env, issuer: &Address) -> bool {
    if let Some(registry_addr) = get_registry_contract(env) {
        let result: bool = env.invoke_contract(
            &registry_addr,
            &Symbol::new(env, "is_trusted_issuer_any"),
            (issuer.clone(),).into_val(env),
        );
        return result;
    }

    // Fallback: in-contract allow-list.
    let key = RegistryKey::TrustedIssuer(issuer.clone());
    env.storage().persistent().has(&key)
}
