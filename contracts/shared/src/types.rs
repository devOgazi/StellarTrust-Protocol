//! Shared types for the StellarTrust Protocol.
//!
//! These types are referenced across the identity, credit-score, registry,
//! and governance contracts and must remain consistent with the Soroban SDK
//! conventions (all types must implement `Clone`, and where stored in
//! contract state they must implement `soroban_sdk::contracttype`).

use soroban_sdk::{contracttype, Address, Bytes, BytesN, String, Vec};

// ---------------------------------------------------------------------------
// Asset
// ---------------------------------------------------------------------------

/// Represents a Stellar asset — either the native XLM asset or a classic
/// issued asset identified by its 4-byte or 12-byte alphanumeric code and the
/// issuing account address.
///
/// Mirrors the asset representation used throughout the Stellar network and is
/// consistent with `soroban_sdk`'s own asset helpers.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Asset {
    /// The native XLM asset.
    Native,
    /// A classic Stellar issued asset (e.g. USDC, EURC).
    ///
    /// * `code`   — up to 12-character ASCII asset code stored as raw bytes.
    /// * `issuer` — the Stellar account address of the issuing anchor.
    Issued(AssetCode, Address),
}

/// Raw asset code bytes (up to 12 ASCII characters, zero-padded).
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AssetCode(pub BytesN<12>);

// ---------------------------------------------------------------------------
// Credential types (shared across identity & registry contracts)
// ---------------------------------------------------------------------------

/// The set of verifiable credential types recognised by the StellarTrust
/// protocol, as specified in the README's Identity Contract section.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CredentialType {
    KYCBasic,
    KYCVerified,
    ProofOfAddress,
    EmploymentVerification,
    IncomeVerification,
    EducationCertificate,
    BusinessRegistration,
    /// Catch-all for issuer-defined credential types not enumerated above.
    Custom(String),
}

// ---------------------------------------------------------------------------
// DID & Identity types
// ---------------------------------------------------------------------------

/// A globally unique credential identifier stored inside a `DIDDocument`.
pub type CredentialId = BytesN<32>;

/// A reference to a verifiable credential stored in a `DIDDocument`.
///
/// Sensitive payload lives off-chain (IPFS); only the hash and metadata are
/// stored on-chain.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CredentialRef {
    /// SHA-256 hash used as the on-chain credential identifier.
    pub id: CredentialId,
    /// The type of this credential.
    pub credential_type: CredentialType,
    /// The issuer's Stellar account address.
    pub issuer: Address,
    /// Unix timestamp (seconds) when the credential was issued.
    pub issued_at: u64,
    /// Optional Unix timestamp (seconds) when the credential expires.
    pub expires_at: Option<u64>,
    /// SHA-256 hash of the off-chain credential payload for tamper detection.
    pub credential_hash: BytesN<32>,
}

/// A single verification method entry in a DID document (Ed25519 key).
#[contracttype]
#[derive(Clone, Debug)]
pub struct VerificationMethod {
    /// Fragment identifier, e.g. `did:stellar:G...#primary`.
    pub id: String,
    /// Key type — always `"Ed25519VerificationKey2020"` in this version.
    pub key_type: String,
    /// Controller DID string.
    pub controller: String,
    /// Raw 32-byte Ed25519 public key.
    pub public_key: BytesN<32>,
}

/// The on-chain representation of a DID document anchored to a Stellar
/// account, as specified in the README.
#[contracttype]
#[derive(Clone, Debug)]
pub struct DIDDocument {
    /// The DID string: `did:stellar:<stellar_account_id>`.
    pub did: String,
    /// The controlling Stellar account address.
    pub controller: Address,
    /// Verification methods (public keys) associated with this DID.
    pub verification_methods: Vec<VerificationMethod>,
    /// Credentials attached to this identity.
    pub credentials: Vec<CredentialRef>,
    /// Unix timestamp (seconds) when the DID was first created.
    pub created_at: u64,
    /// Unix timestamp (seconds) of the last update.
    pub updated_at: u64,
}

// ---------------------------------------------------------------------------
// Attestation types
// ---------------------------------------------------------------------------

/// A structured claim made by a trusted issuer about a subject's identity
/// attribute.
#[contracttype]
#[derive(Clone, Debug)]
pub struct AttestationClaim {
    /// Human-readable claim key, e.g. `"kyc_tier"`.
    pub claim_key: String,
    /// Encoded claim value bytes (interpretation is claim-key-specific).
    pub claim_value: Bytes,
    /// Optional expiry Unix timestamp (seconds).
    pub expires_at: Option<u64>,
}

/// A full attestation record stored on-chain.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Attestation {
    /// The trusted issuer making the claim.
    pub issuer: Address,
    /// The subject identity being attested.
    pub subject: Address,
    /// The claim content.
    pub claim: AttestationClaim,
    /// Unix timestamp when the attestation was recorded.
    pub attested_at: u64,
}
