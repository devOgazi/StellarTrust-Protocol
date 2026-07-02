//! StellarTrust Identity Contract — main entry point.
//!
//! This contract manages Decentralized Identifiers (DIDs) anchored to Stellar
//! keypairs and the verifiable credentials attached to them.
//!
//! # Public interface (matches README spec exactly)
//!
//! | Function              | Description                                  |
//! |-----------------------|----------------------------------------------|
//! | `create_did`          | Create a new DID for a Stellar account       |
//! | `add_credential`      | Add a verifiable credential to an identity   |
//! | `revoke_credential`   | Revoke a credential                          |
//! | `resolve_did`         | Resolve a DID document                       |
//! | `attest`              | Add an attestation from a trusted issuer     |
//! | `register_issuer`     | Admin: register a trusted issuer             |

#![no_std]

mod attestation;
mod credentials;
mod did;
mod errors;
mod registry_check;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String};

use stellartrust_shared::types::{AttestationClaim, CredentialType, DIDDocument};

use attestation::attest as do_attest;
use credentials::{add_credential as do_add_credential, revoke_credential as do_revoke_credential};
use did::{create_did as do_create_did, resolve_did as do_resolve_did};
use errors::IdentityError;
use registry_check::register_trusted_issuer;

// ---------------------------------------------------------------------------
// Contract definition
// ---------------------------------------------------------------------------

#[contract]
pub struct IdentityContract;

#[contractimpl]
impl IdentityContract {
    // -----------------------------------------------------------------------
    // DID management
    // -----------------------------------------------------------------------

    /// Creates a new DID for `owner`.
    ///
    /// `did_string`  — the canonical `did:stellar:<G...>` string.
    /// `primary_key` — raw 32-byte Ed25519 public key for the primary
    ///                 verification method.
    ///
    /// Requires `owner` to have authorised the transaction.
    ///
    /// # Errors
    /// * [`IdentityError::DuplicateDID`] if `owner` already has a DID.
    pub fn create_did(
        env: Env,
        owner: Address,
        did_string: String,
        primary_key: BytesN<32>,
    ) -> Result<DIDDocument, IdentityError> {
        owner.require_auth();
        do_create_did(&env, owner, did_string, primary_key)
    }

    /// Resolves and returns the DID document for `owner`.
    ///
    /// # Errors
    /// * [`IdentityError::DIDNotFound`] if no DID exists for `owner`.
    pub fn resolve_did(env: Env, owner: Address) -> Result<DIDDocument, IdentityError> {
        do_resolve_did(&env, owner)
    }

    // -----------------------------------------------------------------------
    // Credential management
    // -----------------------------------------------------------------------

    /// Adds a verifiable credential to `owner`'s DID document.
    ///
    /// Returns the `CredentialId` (`credential_hash`) on success.
    ///
    /// Requires `issuer` to authorise the transaction and to be a registry-
    /// trusted issuer for `credential_type`.
    pub fn add_credential(
        env: Env,
        owner: Address,
        credential_type: CredentialType,
        issuer: Address,
        credential_hash: BytesN<32>,
        expiry: Option<u64>,
    ) -> Result<BytesN<32>, IdentityError> {
        issuer.require_auth();
        do_add_credential(&env, owner, credential_type, issuer, credential_hash, expiry)
    }

    /// Revokes a credential from `owner`'s DID document.
    ///
    /// Only the original issuer of the credential may call this. Requires
    /// `issuer` to authorise the transaction.
    pub fn revoke_credential(
        env: Env,
        issuer: Address,
        owner: Address,
        credential_id: BytesN<32>,
    ) -> Result<(), IdentityError> {
        issuer.require_auth();
        do_revoke_credential(&env, issuer, owner, credential_id)
    }

    // -----------------------------------------------------------------------
    // Attestation
    // -----------------------------------------------------------------------

    /// Records an attestation claim by a trusted `issuer` about `subject`.
    ///
    /// Requires `issuer` to authorise the transaction and to be registered as
    /// a trusted issuer.
    pub fn attest(
        env: Env,
        issuer: Address,
        subject: Address,
        claim: AttestationClaim,
    ) -> Result<(), IdentityError> {
        issuer.require_auth();
        do_attest(&env, issuer, subject, claim)
    }

    // -----------------------------------------------------------------------
    // Admin
    // -----------------------------------------------------------------------

    /// Registers `issuer` as a trusted issuer for `credential_type`.
    ///
    /// Pass `None` for `credential_type` to trust the issuer for all types.
    ///
    /// In a production deployment this function would require multi-sig admin
    /// authorisation; for the MVP the contract admin's address is used.
    pub fn register_issuer(
        env: Env,
        admin: Address,
        issuer: Address,
        credential_type: Option<CredentialType>,
    ) {
        admin.require_auth();
        register_trusted_issuer(&env, issuer, credential_type);
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Bytes, BytesN, Env, String,
    };
    use stellartrust_shared::types::{AttestationClaim, CredentialType};

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /// Spin up an Env, mock all auths, and deploy the contract.
    fn setup() -> (Env, Address) {
        let env = Env::default();
        env.mock_all_auths();
        // `register` is the current API; register_contract is deprecated.
        let contract_id = env.register(IdentityContract, ());
        (env, contract_id)
    }

    fn make_primary_key(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[1u8; 32])
    }

    fn make_credential_hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn owner_did_string(env: &Env) -> (Address, String) {
        let owner = Address::generate(env);
        let did = String::from_str(env, "did:stellar:GABCDEF1234567890ABCDEF");
        (owner, did)
    }

    // -----------------------------------------------------------------------
    // DID creation tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_create_did_succeeds() {
        let (env, contract_id) = setup();
        let client = IdentityContractClient::new(&env, &contract_id);

        let (owner, did_string) = owner_did_string(&env);
        let pk = make_primary_key(&env);

        // The generated client returns the value directly and panics on error.
        let doc = client.create_did(&owner, &did_string, &pk);

        assert_eq!(doc.controller, owner);
        assert_eq!(doc.did, did_string);
        assert_eq!(doc.credentials.len(), 0);
        assert_eq!(doc.verification_methods.len(), 1);
    }

    #[test]
    fn test_create_did_sets_timestamps() {
        let (env, contract_id) = setup();
        env.ledger().set_timestamp(1_000_000);
        let client = IdentityContractClient::new(&env, &contract_id);

        let (owner, did_string) = owner_did_string(&env);
        let pk = make_primary_key(&env);

        let doc = client.create_did(&owner, &did_string, &pk);

        assert_eq!(doc.created_at, 1_000_000);
        assert_eq!(doc.updated_at, 1_000_000);
    }

    // -----------------------------------------------------------------------
    // Duplicate DID prevention test
    // -----------------------------------------------------------------------

    #[test]
    fn test_duplicate_did_is_rejected() {
        let (env, contract_id) = setup();
        let client = IdentityContractClient::new(&env, &contract_id);

        let (owner, did_string) = owner_did_string(&env);
        let pk = make_primary_key(&env);

        // First creation must succeed.
        client.create_did(&owner, &did_string, &pk);

        // Second creation for the same owner must fail (try_* returns Result).
        let result = client.try_create_did(&owner, &did_string, &pk);
        assert!(result.is_err(), "duplicate DID should be rejected");
    }

    // -----------------------------------------------------------------------
    // Credential add / revoke tests
    // -----------------------------------------------------------------------

    /// Helper: register a trusted issuer, create a DID, return
    /// (env, contract_id, owner, issuer).
    fn setup_with_did_and_issuer() -> (Env, Address, Address, Address) {
        let (env, contract_id) = setup();
        let client = IdentityContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);
        let (owner, did_string) = owner_did_string(&env);
        let pk = make_primary_key(&env);

        // Register issuer as trusted for KYCVerified.
        client.register_issuer(&admin, &issuer, &Some(CredentialType::KYCVerified));

        // Create the DID.
        client.create_did(&owner, &did_string, &pk);

        (env, contract_id, owner, issuer)
    }

    #[test]
    fn test_add_credential_succeeds() {
        let (env, contract_id, owner, issuer) = setup_with_did_and_issuer();
        let client = IdentityContractClient::new(&env, &contract_id);

        let hash = make_credential_hash(&env, 42);
        let cred_id = client.add_credential(
            &owner,
            &CredentialType::KYCVerified,
            &issuer,
            &hash,
            &None,
        );

        assert_eq!(cred_id, hash);

        // Resolve and verify the credential is present.
        let doc = client.resolve_did(&owner);
        assert_eq!(doc.credentials.len(), 1);
        assert_eq!(doc.credentials.get(0).unwrap().credential_hash, hash);
    }

    #[test]
    fn test_revoke_credential_succeeds() {
        let (env, contract_id, owner, issuer) = setup_with_did_and_issuer();
        let client = IdentityContractClient::new(&env, &contract_id);

        let hash = make_credential_hash(&env, 7);
        client.add_credential(
            &owner,
            &CredentialType::KYCVerified,
            &issuer,
            &hash,
            &None,
        );

        // Revoke it.
        client.revoke_credential(&issuer, &owner, &hash);

        // Credential list should now be empty.
        let doc = client.resolve_did(&owner);
        assert_eq!(doc.credentials.len(), 0);
    }

    #[test]
    fn test_revoke_nonexistent_credential_fails() {
        let (env, contract_id, owner, issuer) = setup_with_did_and_issuer();
        let client = IdentityContractClient::new(&env, &contract_id);

        let missing_hash = make_credential_hash(&env, 99);
        let result = client.try_revoke_credential(&issuer, &owner, &missing_hash);
        assert!(
            result.is_err(),
            "revoking a nonexistent credential should fail"
        );
    }

    // -----------------------------------------------------------------------
    // Attestation from non-trusted issuer test
    // -----------------------------------------------------------------------

    #[test]
    fn test_attestation_from_untrusted_issuer_is_rejected() {
        let (env, contract_id) = setup();
        let client = IdentityContractClient::new(&env, &contract_id);

        // Create a DID for the subject.
        let (subject, did_string) = owner_did_string(&env);
        let pk = make_primary_key(&env);
        client.create_did(&subject, &did_string, &pk);

        // Use an issuer that has NOT been registered.
        let untrusted_issuer = Address::generate(&env);
        let claim = AttestationClaim {
            claim_key: String::from_str(&env, "kyc_tier"),
            claim_value: Bytes::from_slice(&env, &[1u8]),
            expires_at: None,
        };

        let result = client.try_attest(&untrusted_issuer, &subject, &claim);
        assert!(
            result.is_err(),
            "attestation from an untrusted issuer should be rejected"
        );
    }

    #[test]
    fn test_attestation_from_trusted_issuer_succeeds() {
        let (env, contract_id) = setup();
        let client = IdentityContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);

        // Register as trusted for any credential type.
        client.register_issuer(&admin, &issuer, &None);

        // Create a DID for the subject.
        let (subject, did_string) = owner_did_string(&env);
        let pk = make_primary_key(&env);
        client.create_did(&subject, &did_string, &pk);

        let claim = AttestationClaim {
            claim_key: String::from_str(&env, "kyc_tier"),
            claim_value: Bytes::from_slice(&env, &[2u8]),
            expires_at: None,
        };

        // Should not panic.
        client.attest(&issuer, &subject, &claim);
    }

    // -----------------------------------------------------------------------
    // Credential from untrusted issuer test
    // -----------------------------------------------------------------------

    #[test]
    fn test_add_credential_from_untrusted_issuer_fails() {
        let (env, contract_id) = setup();
        let client = IdentityContractClient::new(&env, &contract_id);

        // Create a DID but do NOT register the issuer.
        let (owner, did_string) = owner_did_string(&env);
        let pk = make_primary_key(&env);
        client.create_did(&owner, &did_string, &pk);

        let untrusted = Address::generate(&env);
        let hash = make_credential_hash(&env, 1);

        let result = client.try_add_credential(
            &owner,
            &CredentialType::KYCBasic,
            &untrusted,
            &hash,
            &None,
        );
        assert!(
            result.is_err(),
            "add_credential from untrusted issuer should fail"
        );
    }
}
