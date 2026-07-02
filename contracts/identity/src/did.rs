//! DID creation and resolution logic for the StellarTrust Identity contract.
//!
//! Each Stellar account can hold exactly one DID document. The document is
//! keyed by the owner's `Address` and stored in contract persistent storage.

use soroban_sdk::{contracttype, Address, BytesN, Env, String, Vec};

use stellartrust_shared::{
    constants::{DID_STORAGE_BUMP_LEDGERS, DID_STORAGE_BUMP_THRESHOLD},
    types::{CredentialRef, DIDDocument, VerificationMethod},
};

use crate::errors::IdentityError;

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/// Persistent storage key variants for the identity contract.
#[contracttype]
pub enum DataKey {
    /// DID document keyed by the owner's address.
    DIDDoc(Address),
}

// ---------------------------------------------------------------------------
// Public DID functions (called by the contract entry point in lib.rs)
// ---------------------------------------------------------------------------

/// Creates a new DID document for `owner`.
///
/// * Returns [`IdentityError::DuplicateDID`] if a DID already exists for
///   this owner.
/// * `did_string` must be the canonical `did:stellar:<G...>` string supplied
///   by the caller (validated at the contract boundary).
/// * `primary_key` is the raw 32-byte Ed25519 public key to register as the
///   primary verification method.
pub fn create_did(
    env: &Env,
    owner: Address,
    did_string: String,
    primary_key: BytesN<32>,
) -> Result<DIDDocument, IdentityError> {
    let key = DataKey::DIDDoc(owner.clone());

    // Reject duplicate DIDs.
    if env.storage().persistent().has(&key) {
        return Err(IdentityError::DuplicateDID);
    }

    let now = env.ledger().timestamp();

    let vm = VerificationMethod {
        id: did_string.clone(),
        key_type: String::from_str(env, "Ed25519VerificationKey2020"),
        controller: did_string.clone(),
        public_key: primary_key,
    };

    let doc = DIDDocument {
        did: did_string,
        controller: owner.clone(),
        verification_methods: Vec::from_slice(env, &[vm]),
        credentials: Vec::new(env),
        created_at: now,
        updated_at: now,
    };

    env.storage().persistent().set(&key, &doc);
    env.storage().persistent().extend_ttl(
        &key,
        DID_STORAGE_BUMP_THRESHOLD,
        DID_STORAGE_BUMP_LEDGERS,
    );

    Ok(doc)
}

/// Resolves and returns the DID document for `owner`.
///
/// Returns [`IdentityError::DIDNotFound`] if no DID exists for the address.
pub fn resolve_did(env: &Env, owner: Address) -> Result<DIDDocument, IdentityError> {
    let key = DataKey::DIDDoc(owner);
    match env.storage().persistent().get::<DataKey, DIDDocument>(&key) {
        Some(doc) => {
            env.storage().persistent().extend_ttl(
                &key,
                DID_STORAGE_BUMP_THRESHOLD,
                DID_STORAGE_BUMP_LEDGERS,
            );
            Ok(doc)
        }
        None => Err(IdentityError::DIDNotFound),
    }
}

/// Persists an updated `DIDDocument` back to storage, refreshing `updated_at`.
pub fn save_did(env: &Env, mut doc: DIDDocument) -> DIDDocument {
    doc.updated_at = env.ledger().timestamp();
    let key = DataKey::DIDDoc(doc.controller.clone());
    env.storage().persistent().set(&key, &doc);
    env.storage().persistent().extend_ttl(
        &key,
        DID_STORAGE_BUMP_THRESHOLD,
        DID_STORAGE_BUMP_LEDGERS,
    );
    doc
}

/// Returns the credential list for an owner, or an empty vec if the DID does
/// not exist.
pub fn get_credentials(env: &Env, owner: &Address) -> Vec<CredentialRef> {
    let key = DataKey::DIDDoc(owner.clone());
    env.storage()
        .persistent()
        .get::<DataKey, DIDDocument>(&key)
        .map(|doc| doc.credentials)
        .unwrap_or_else(|| Vec::new(env))
}
