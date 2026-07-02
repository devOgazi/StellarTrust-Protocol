//! Verifiable credential storage and revocation for the StellarTrust
//! Identity contract.
//!
//! Credentials are attached to an existing DID document. Only registry-
//! trusted issuers may add credentials; only the issuer of a given credential
//! may revoke it.

use soroban_sdk::{Address, BytesN, Env};

use stellartrust_shared::{
    constants::MAX_CREDENTIALS_PER_DID,
    types::{CredentialRef, CredentialType},
};

use crate::{
    did::{resolve_did, save_did},
    errors::IdentityError,
    registry_check::is_trusted_issuer,
};

/// Adds a verifiable credential to the DID document of `owner`.
///
/// # Arguments
///
/// * `owner`           — the subject whose DID receives the credential.
/// * `credential_type` — the type of credential being issued.
/// * `issuer`          — the issuing party; must be a registry-trusted issuer
///                       for the given `credential_type`.
/// * `credential_hash` — SHA-256 hash of the off-chain credential payload.
/// * `expiry`          — optional Unix timestamp (seconds) after which the
///                       credential is considered expired.
///
/// Returns the `CredentialId` (same as `credential_hash`) on success.
///
/// # Errors
///
/// * [`IdentityError::DIDNotFound`]         — `owner` has no DID.
/// * [`IdentityError::UnauthorizedIssuer`]  — `issuer` is not trusted.
/// * [`IdentityError::CredentialLimitReached`] — DID already holds the max.
pub fn add_credential(
    env: &Env,
    owner: Address,
    credential_type: CredentialType,
    issuer: Address,
    credential_hash: BytesN<32>,
    expiry: Option<u64>,
) -> Result<BytesN<32>, IdentityError> {
    // 1. Issuer must be trusted for this credential type.
    if !is_trusted_issuer(env, &issuer, &credential_type) {
        return Err(IdentityError::UnauthorizedIssuer);
    }

    // 2. Load existing DID document.
    let mut doc = resolve_did(env, owner)?;

    // 3. Enforce credential count limit.
    if doc.credentials.len() >= MAX_CREDENTIALS_PER_DID {
        return Err(IdentityError::CredentialLimitReached);
    }

    let now = env.ledger().timestamp();

    let cred = CredentialRef {
        id: credential_hash.clone(),
        credential_type,
        issuer,
        issued_at: now,
        expires_at: expiry,
        credential_hash: credential_hash.clone(),
    };

    doc.credentials.push_back(cred);
    save_did(env, doc);

    Ok(credential_hash)
}

/// Revokes a credential from the DID document of `owner`.
///
/// Only the original issuer of the credential may revoke it.
///
/// # Errors
///
/// * [`IdentityError::DIDNotFound`]       — `owner` has no DID.
/// * [`IdentityError::CredentialNotFound`] — no credential matches `credential_id`.
/// * [`IdentityError::UnauthorizedIssuer`] — `issuer` did not issue the credential.
pub fn revoke_credential(
    env: &Env,
    issuer: Address,
    owner: Address,
    credential_id: BytesN<32>,
) -> Result<(), IdentityError> {
    let mut doc = resolve_did(env, owner)?;

    // Find the credential index.
    let mut found_idx: Option<u32> = None;
    for (i, cred) in doc.credentials.iter().enumerate() {
        if cred.id == credential_id {
            if cred.issuer != issuer {
                return Err(IdentityError::UnauthorizedIssuer);
            }
            found_idx = Some(i as u32);
            break;
        }
    }

    let idx = found_idx.ok_or(IdentityError::CredentialNotFound)?;
    doc.credentials.remove(idx);
    save_did(env, doc);

    Ok(())
}
