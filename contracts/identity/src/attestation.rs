//! Issuer attestation logic for the StellarTrust Identity contract.
//!
//! Attestations allow trusted issuers to make structured claims about a
//! subject's identity attributes without attaching a full credential. They
//! are stored separately from the DID document's credential list.

use soroban_sdk::{contracttype, Address, Env, Vec};

use stellartrust_shared::{
    constants::{
        DID_STORAGE_BUMP_LEDGERS, DID_STORAGE_BUMP_THRESHOLD, MAX_ATTESTATIONS_PER_SUBJECT,
    },
    types::{Attestation, AttestationClaim},
};

use crate::{did::resolve_did, errors::IdentityError, registry_check::is_trusted_issuer_any};

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

/// Persistent storage key for the attestation list of a subject.
#[contracttype]
pub enum AttestationKey {
    /// All attestations made about a given subject address.
    Attestations(Address),
}

// ---------------------------------------------------------------------------
// Public attestation function
// ---------------------------------------------------------------------------

/// Records an attestation claim made by `issuer` about `subject`.
///
/// The issuer must be a registry-trusted issuer (for any credential type) and
/// the subject must already have a DID. The attestation is appended to the
/// subject's persistent attestation list.
///
/// # Errors
///
/// * [`IdentityError::DIDNotFound`]             — `subject` has no DID.
/// * [`IdentityError::UnauthorizedIssuer`]      — `issuer` is not trusted.
/// * [`IdentityError::AttestationLimitReached`] — subject's list is full.
pub fn attest(
    env: &Env,
    issuer: Address,
    subject: Address,
    claim: AttestationClaim,
) -> Result<(), IdentityError> {
    // Issuer must be trusted for at least one credential type.
    if !is_trusted_issuer_any(env, &issuer) {
        return Err(IdentityError::UnauthorizedIssuer);
    }

    // Subject must have a DID.
    resolve_did(env, subject.clone())?;

    let key = AttestationKey::Attestations(subject.clone());
    let mut attestations: Vec<Attestation> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    if attestations.len() >= MAX_ATTESTATIONS_PER_SUBJECT {
        return Err(IdentityError::AttestationLimitReached);
    }

    let record = Attestation {
        issuer,
        subject,
        claim,
        attested_at: env.ledger().timestamp(),
    };

    attestations.push_back(record);
    env.storage().persistent().set(&key, &attestations);
    env.storage().persistent().extend_ttl(
        &key,
        DID_STORAGE_BUMP_THRESHOLD,
        DID_STORAGE_BUMP_LEDGERS,
    );

    Ok(())
}

/// Returns all attestations stored for a given subject.
pub fn get_attestations(env: &Env, subject: Address) -> Vec<Attestation> {
    let key = AttestationKey::Attestations(subject);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}
