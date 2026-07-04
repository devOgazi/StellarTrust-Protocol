//! Credential schema registry for the StellarTrust Registry contract.
//!
//! Schemas define the structure and validation rules for verifiable credentials
//! of each type. They are stored on-chain so that any party can resolve the
//! canonical schema for a given credential type and version.

use soroban_sdk::{contracttype, Address, BytesN, Env, String};

// ---------------------------------------------------------------------------
// Storage bump constants
// ---------------------------------------------------------------------------

/// Keep schema records alive for ~1 year.
const SCHEMA_BUMP_LEDGERS: u32 = 6_307_200;
/// Extend TTL when fewer than 30 days remain.
const SCHEMA_BUMP_THRESHOLD: u32 = 518_400;

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// A unique identifier for a registered credential schema.
///
/// Computed as the SHA-256 hash of the schema payload (JSON-LD document)
/// so it is both globally unique and content-addressable.
pub type SchemaId = BytesN<32>;

/// A registered credential schema describing the structure of a verifiable
/// credential payload.
///
/// This matches the README's `CredentialSchema` definition.
#[contracttype]
#[derive(Clone, Debug)]
pub struct CredentialSchema {
    /// Content-addressable schema identifier (SHA-256 of the schema document).
    pub id: SchemaId,
    /// Human-readable schema name, e.g. `"KYCVerifiedV1"`.
    pub name: String,
    /// Semantic version string, e.g. `"1.0.0"`.
    pub version: String,
    /// The credential type this schema describes (as a string label for
    /// flexibility — avoids importing `CredentialType` into the schema store).
    pub credential_type_label: String,
    /// Address of the account that registered this schema.
    pub author: Address,
    /// IPFS CID pointing to the full JSON-LD schema document.
    pub ipfs_cid: String,
    /// Unix timestamp (seconds) when the schema was registered.
    pub registered_at: u64,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/// Registry persistent storage keys for schema data.
#[contracttype]
pub enum SchemaKey {
    /// Schema record keyed by its content-hash identifier.
    Schema(SchemaId),
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/// Registers a new credential schema in the registry.
///
/// Returns the `SchemaId` of the newly registered schema.
///
/// # Note
/// The caller is responsible for computing `schema.id` as the SHA-256 hash of
/// the canonical schema document before calling this function. The registry
/// stores the supplied `id` as-is; it does not re-hash.
///
/// Authorisation (ensuring the caller has the right to register a schema) is
/// handled by the contract entry point before delegating here.
pub fn register_schema(env: &Env, mut schema: CredentialSchema) -> SchemaId {
    schema.registered_at = env.ledger().timestamp();
    let key = SchemaKey::Schema(schema.id.clone());
    let id = schema.id.clone();

    env.storage().persistent().set(&key, &schema);
    env.storage()
        .persistent()
        .extend_ttl(&key, SCHEMA_BUMP_THRESHOLD, SCHEMA_BUMP_LEDGERS);

    id
}

/// Returns the `CredentialSchema` registered under `schema_id`, or `None` if
/// no schema with that id exists.
pub fn get_schema(env: &Env, schema_id: &SchemaId) -> Option<CredentialSchema> {
    let key = SchemaKey::Schema(schema_id.clone());
    env.storage().persistent().get(&key)
}
