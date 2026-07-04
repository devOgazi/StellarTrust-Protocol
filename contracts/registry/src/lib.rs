//! StellarTrust Registry Contract — main entry point.
//!
//! The Registry contract manages:
//! * **Trusted issuers** — accounts authorised to issue verifiable credentials
//!   of specific types.
//! * **Credential schemas** — on-chain schema definitions for each credential
//!   type.
//!
//! # Public interface (matches README spec exactly)
//!
//! | Function           | Description                                         |
//! |--------------------|-----------------------------------------------------|
//! | `register_issuer`  | Admin: register a new trusted credential issuer     |
//! | `is_trusted_issuer`| Query: check if issuer is trusted for a cred type   |
//! | `register_schema`  | Register a new credential schema                    |
//! | `get_issuer`       | Query: retrieve issuer record                       |
//! | `get_schema`       | Query: retrieve schema record                       |

#![no_std]

pub mod issuers;
pub mod schemas;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};

use stellartrust_shared::types::CredentialType;

use issuers::{
    get_issuer as do_get_issuer, is_trusted_issuer as do_is_trusted_issuer,
    is_trusted_issuer_any as do_is_trusted_issuer_any, register_issuer as do_register_issuer,
    IssuerMetadata, IssuerRecord,
};
use schemas::{
    get_schema as do_get_schema, register_schema as do_register_schema, CredentialSchema, SchemaId,
};

// ---------------------------------------------------------------------------
// Contract definition
// ---------------------------------------------------------------------------

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    // -----------------------------------------------------------------------
    // Issuer management
    // -----------------------------------------------------------------------

    /// Registers a new trusted credential issuer.
    ///
    /// # Arguments
    /// * `admin`            — the registering admin (must authorise the call).
    /// * `issuer`           — the Stellar account to register as a trusted issuer.
    /// * `issuer_metadata`  — display name, URL, and active flag for the issuer.
    /// * `credential_types` — the credential types the issuer is authorised to
    ///                        issue. Pass an empty list to authorise all types.
    ///
    /// # Notes
    /// In a production deployment, `admin` would be the contract's own admin
    /// account checked against a stored admin key. For the MVP the call
    /// validates that the signer authorises the transaction.
    pub fn register_issuer(
        env: Env,
        admin: Address,
        issuer: Address,
        issuer_metadata: IssuerMetadata,
        credential_types: Vec<CredentialType>,
    ) {
        admin.require_auth();
        do_register_issuer(&env, issuer, issuer_metadata, credential_types);
    }

    /// Returns `true` if `issuer` is a registered, active trusted issuer for
    /// the given `credential_type`.
    ///
    /// An issuer registered with an empty `credential_types` list (i.e.
    /// `IssuerScope::Any`) is trusted for all types.
    pub fn is_trusted_issuer(
        env: Env,
        issuer: Address,
        credential_type: CredentialType,
    ) -> bool {
        do_is_trusted_issuer(&env, &issuer, &credential_type)
    }

    /// Returns `true` if `issuer` is a registered, active trusted issuer for
    /// at least one credential type.
    ///
    /// Used by the identity contract's `attest()` path, which is not tied to a
    /// specific credential type.
    pub fn is_trusted_issuer_any(env: Env, issuer: Address) -> bool {
        do_is_trusted_issuer_any(&env, &issuer)
    }

    /// Returns the full `IssuerRecord` for `issuer`, or panics if not found.
    pub fn get_issuer(env: Env, issuer: Address) -> IssuerRecord {
        do_get_issuer(&env, &issuer).expect("issuer not registered")
    }

    // -----------------------------------------------------------------------
    // Schema management
    // -----------------------------------------------------------------------

    /// Registers a new credential schema.
    ///
    /// # Arguments
    /// * `schema` — the full schema record including the pre-computed
    ///              content-hash `id` and IPFS CID of the schema document.
    ///
    /// Returns the `SchemaId` of the registered schema.
    ///
    /// The caller is responsible for computing the `SchemaId` before calling
    /// this function. The registry stores it as-is.
    pub fn register_schema(env: Env, author: Address, schema: CredentialSchema) -> SchemaId {
        author.require_auth();
        do_register_schema(&env, schema)
    }

    /// Returns the `CredentialSchema` for `schema_id`, or panics if not found.
    pub fn get_schema(env: Env, schema_id: BytesN<32>) -> CredentialSchema {
        do_get_schema(&env, &schema_id).expect("schema not found")
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, BytesN, Env, String, Vec};
    use stellartrust_shared::types::CredentialType;

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn setup() -> (Env, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(RegistryContract, ());
        (env, contract_id)
    }

    fn make_metadata(env: &Env, name: &str) -> IssuerMetadata {
        IssuerMetadata {
            name: String::from_str(env, name),
            url: String::from_str(env, "https://issuer.example.com"),
            registered_at: 0,
            active: true,
        }
    }

    fn make_schema_id(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    // -----------------------------------------------------------------------
    // Issuer registration tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_register_issuer_for_specific_type() {
        let (env, contract_id) = setup();
        let client = RegistryContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);
        let meta = make_metadata(&env, "Acme KYC");

        let mut types: Vec<CredentialType> = Vec::new(&env);
        types.push_back(CredentialType::KYCVerified);

        client.register_issuer(&admin, &issuer, &meta, &types);

        assert!(client.is_trusted_issuer(&issuer, &CredentialType::KYCVerified));
        assert!(!client.is_trusted_issuer(&issuer, &CredentialType::KYCBasic));
    }

    #[test]
    fn test_register_issuer_for_all_types() {
        let (env, contract_id) = setup();
        let client = RegistryContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);
        let meta = make_metadata(&env, "Omni Issuer");

        // Empty list → trusted for all.
        let types: Vec<CredentialType> = Vec::new(&env);
        client.register_issuer(&admin, &issuer, &meta, &types);

        assert!(client.is_trusted_issuer(&issuer, &CredentialType::KYCBasic));
        assert!(client.is_trusted_issuer(&issuer, &CredentialType::KYCVerified));
        assert!(client.is_trusted_issuer(&issuer, &CredentialType::ProofOfAddress));
        assert!(client.is_trusted_issuer_any(&issuer));
    }

    #[test]
    fn test_unregistered_issuer_is_not_trusted() {
        let (env, contract_id) = setup();
        let client = RegistryContractClient::new(&env, &contract_id);

        let stranger = Address::generate(&env);
        assert!(!client.is_trusted_issuer(&stranger, &CredentialType::KYCVerified));
        assert!(!client.is_trusted_issuer_any(&stranger));
    }

    // -----------------------------------------------------------------------
    // Schema registration tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_register_and_retrieve_schema() {
        let (env, contract_id) = setup();
        let client = RegistryContractClient::new(&env, &contract_id);

        let author = Address::generate(&env);
        let schema_id = make_schema_id(&env, 0xAB);

        let schema = CredentialSchema {
            id: schema_id.clone(),
            name: String::from_str(&env, "KYCVerifiedV1"),
            version: String::from_str(&env, "1.0.0"),
            credential_type_label: String::from_str(&env, "KYCVerified"),
            author: author.clone(),
            ipfs_cid: String::from_str(&env, "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"),
            registered_at: 0,
        };

        let returned_id = client.register_schema(&author, &schema);
        assert_eq!(returned_id, schema_id);

        let fetched = client.get_schema(&schema_id);
        assert_eq!(fetched.name, String::from_str(&env, "KYCVerifiedV1"));
        assert_eq!(fetched.version, String::from_str(&env, "1.0.0"));
    }
}
