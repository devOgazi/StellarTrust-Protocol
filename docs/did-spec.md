# `did:stellar` Method Specification

This document specifies the `did:stellar` DID method implemented by StellarTrust Protocol. It expands on the [Identity System section of the root README](../README.md#-identity-system-did) with resolution mechanics, contract interface, and implementation notes.

---

## Table of Contents

- [DID Method Syntax](#did-method-syntax)
- [DID Document Structure](#did-document-structure)
- [CRUD Operations](#crud-operations)
- [Resolution Algorithm](#resolution-algorithm)
- [Credential Privacy Model](#credential-privacy-model)
- [Verification Method](#verification-method)
- [Implementation: Identity Contract](#implementation-identity-contract)
- [Implementation: Backend DID Resolver](#implementation-backend-did-resolver)

---

## DID Method Syntax

StellarTrust implements the `did:stellar` DID method, anchoring decentralized identifiers to Stellar account keypairs.

**Method name:** `stellar`

**Format:**
```
did:stellar:<stellar_account_id>

Example:
did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ
```

Where `<stellar_account_id>` is a 56-character Base32-encoded Ed25519 public key (Stellar's `G`-prefixed StrKey format).

**Constraint:** The DID identifier is always the base-58 public key of the DID controller. There is no separation between the DID and the controller key — the keypair is the identity.

---

## DID Document Structure

The full W3C DID Document returned by the resolver:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://stellartrust.io/contexts/v1"
  ],
  "id": "did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ",
  "controller": "did:stellar:GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ",
  "verificationMethod": [
    {
      "id": "did:stellar:GAHT...#primary",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:stellar:GAHT...",
      "publicKeyMultibase": "zGAHT..."
    }
  ],
  "authentication": ["did:stellar:GAHT...#primary"],
  "service": [
    {
      "id": "did:stellar:GAHT...#credit-score",
      "type": "CreditScoreService",
      "serviceEndpoint": "https://api.stellartrust.io/score/GAHT..."
    }
  ],
  "credentials": [
    {
      "id": "cred:0x4a3b...",
      "type": "KYCVerified",
      "issuer": "did:stellar:GCK3...",
      "issuedAt": 1717200000,
      "expiresAt": 1748736000,
      "credentialHash": "0x4a3b..."
    }
  ]
}
```

### Field Notes

| Field | Source | Description |
|---|---|---|
| `id` | Derived | `did:stellar:` + Stellar account address |
| `controller` | Derived | Same as `id` (self-sovereign) |
| `verificationMethod` | On-chain / Postgres | Ed25519 public key in multibase encoding |
| `authentication` | Derived | References primary verification method |
| `service` | Generated | Links to the StellarTrust score API |
| `credentials` | On-chain / Postgres | Array of `CredentialRef` objects |

---

## CRUD Operations

### Create

**API:** `POST /api/v1/identity/create`

```json
// Request body
{ "address": "G...", "publicKeyHex": "..." }
```

- Creates an on-chain DID document by invoking `identity.create_did(owner)` on Soroban
- The Stellar address uniquely identifies the DID
- Duplicate creation returns HTTP 409

**Contract function:**
```rust
fn create_did(env: Env, owner: Address) -> DIDDocument
```

### Read (Resolve)

**API:** `GET /api/v1/identity/:address`

Resolution order:
1. **Soroban RPC** (on-chain source of truth): invokes `identity.resolve_did(owner)`
2. **Postgres cache** (fallback if chain unreachable): queries `Identity` + `Credential` tables

**Contract function:**
```rust
fn resolve_did(env: Env, owner: Address) -> DIDDocument
```

### Update (Add Credential)

**API:** `POST /api/v1/identity/credential`

```json
{
  "ownerAddress": "G...",
  "issuerAddress": "G...",
  "credentialType": "KYCVerified",
  "credentialHash": "0x...",
  "ipfsCid": "Qm...",
  "expiresAt": 1748736000
}
```

- Only registered issuers (in Registry contract) may add credentials to an identity
- Credential hash is a SHA-256 of the full credential payload stored on IPFS

**Contract function:**
```rust
fn add_credential(
    env: Env,
    owner: Address,
    credential_type: CredentialType,
    issuer: Address,
    credential_hash: BytesN<32>,
    expiry: Option<u64>
) -> CredentialId
```

### Delete (Revoke Credential)

**API:** `DELETE /api/v1/identity/credential/:id`

- Only the credential owner or issuer may revoke
- Sets `revokedAt` in Postgres; on-chain revocation requires a separate `identity.revoke_credential()` call

**Contract function:**
```rust
fn revoke_credential(env: Env, issuer: Address, credential_id: CredentialId)
```

---

## Resolution Algorithm

```
resolve(did_or_address):
  1. Normalise to raw address (strip "did:stellar:" prefix if present)
  2. Validate Stellar address format (Ed25519 StrKey, G-prefix)
  3. If IDENTITY_CONTRACT_ID is configured:
       a. Call simulateContractCall("resolve_did", [address]) via Soroban RPC
       b. On success: map raw Soroban types to W3C DID Document, return
       c. On failure (network error, no DID): fall through to step 4
  4. Query Postgres: SELECT * FROM Identity WHERE address = :address
       a. If no row: throw "DID not found for address: <address>" → HTTP 404
       b. Include Credentials WHERE revokedAt IS NULL
  5. Build W3C DID Document from Postgres data, return
```

**Soroban RPC endpoint:** configured via `STELLAR_RPC_URL` in `backend/.env`
- Testnet: `https://soroban-testnet.stellar.org`
- Mainnet: `https://soroban-mainnet.stellar.org`

---

## Credential Privacy Model

Sensitive credential data is **never stored on-chain**. The on-chain data contains only:

| On-Chain | Off-Chain (IPFS) |
|---|---|
| Credential type | Full credential payload |
| Issuer address | Supporting documents (KYC photos, etc.) |
| Issuance / expiry timestamps | Personal data (name, DOB, address) |
| SHA-256 hash of payload | ZK-proof witness data |
| IPFS CID | — |

**Encryption:** IPFS payloads are encrypted with the holder's Ed25519 public key (converted to Curve25519 for ECDH-based encryption, using AES-256-GCM for the payload cipher).

**Selective disclosure:** A holder can decrypt their IPFS credential and selectively disclose attributes to verifiers without revealing the full payload. This is the foundation for the Phase 2 ZK-proof presentation layer.

**Hash verification:** Any party with the IPFS CID and the on-chain hash can verify that the IPFS payload has not been tampered with.

---

## Verification Method

StellarTrust uses `Ed25519VerificationKey2020` as the primary verification method type, consistent with the W3C Linked Data Cryptography Suites specification.

**Key encoding:** The Ed25519 public key is encoded using `publicKeyMultibase` with the `z` multibase prefix (base58btc), as required by the `Ed25519VerificationKey2020` suite.

```
publicKeyMultibase: "z" + base58btc(Ed25519PublicKey)
```

Stellar's native key format (`G...` StrKey) is a Base32 encoding of the same 32-byte Ed25519 public key. The backend `crypto.ts` utility handles conversion.

---

## Implementation: Identity Contract

Source: `contracts/identity/src/`

| File | Responsibility |
|---|---|
| `lib.rs` | Contract entry point; exports all public functions |
| `did.rs` | DID creation and resolution logic |
| `credentials.rs` | Credential add/revoke logic |
| `attestation.rs` | Issuer attestation (vouch for identity attributes) |
| `registry_check.rs` | Calls Registry contract to verify issuer is whitelisted |
| `errors.rs` | Custom Soroban error types |

Key design decisions:
- DID documents are stored as a single Soroban `Map<Address, DIDDocument>` keyed by owner address
- Credentials are stored in a `Vec<CredentialRef>` within the DID document
- All writes require the `owner` to authorise via `owner.require_auth()`
- Cross-contract call to Registry contract validates issuers before adding credentials

---

## Implementation: Backend DID Resolver

Source: `backend/src/services/did-resolver.ts`

The `DIDResolverService` class:
- Accepts a Stellar address or `did:stellar:<address>` string
- Tries on-chain Soroban resolution first
- Falls back to Postgres cache on network failure
- Maps raw Soroban types (`BytesN<32>`, `u64`, etc.) to JavaScript-friendly objects
- Returns a fully W3C-compliant DID Document with `@context`, `verificationMethod`, `authentication`, `service`

The resolver is used by:
- `GET /api/v1/identity/:address` — public resolution endpoint
- `POST /api/v1/lender/verify` — credential verification during lender queries

---

## Conformance Notes

StellarTrust's `did:stellar` implementation targets conformance with:
- [W3C DID Core 1.0](https://www.w3.org/TR/did-core/)
- [Ed25519VerificationKey2020](https://w3c-ccg.github.io/lds-ed25519-2020/)
- [Verifiable Credentials Data Model 1.1](https://www.w3.org/TR/vc-data-model/)

Full DID Method specification submission to the W3C DID Specification Registries is planned for Phase 2.
