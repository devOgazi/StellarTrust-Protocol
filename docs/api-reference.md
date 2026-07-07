# API Reference

Complete REST API reference for the StellarTrust Protocol backend. All endpoints are served at `https://api.stellartrust.io/api/v1` (mainnet) or `https://api-testnet.stellartrust.io/api/v1` (testnet).

For interactive exploration, visit the OpenAPI UI at `/docs` when running the backend locally.

---

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Identity Endpoints](#identity-endpoints)
- [Credit Score Endpoints](#credit-score-endpoints)
- [Lender Endpoints](#lender-endpoints)
- [Registry Endpoints](#registry-endpoints)
- [Webhook Endpoints](#webhook-endpoints)
- [Error Responses](#error-responses)

---

## Authentication

StellarTrust implements **SEP-0010 Stellar Web Authentication** for authenticated endpoints (Phase 2 feature). For MVP (Phase 1), auth is **optional** on most endpoints.

**SEP-0010 Flow:**
1. `GET /api/v1/auth?account=G...` → returns challenge transaction
2. Client signs with Freighter/Rabet
3. `POST /api/v1/auth { account, transaction }` → returns JWT
4. Subsequent requests: `Authorization: Bearer <jwt>`

**MVP Behavior:** Endpoints marked "Auth: Optional" accept requests without a JWT. The wallet address in the request body is validated instead.

---

## Rate Limiting

All endpoints are rate-limited via Redis counters:

| Route Type | Limit |
|---|---|
| Read endpoints (`GET /identity`, `GET /score`) | 120 req/min per IP |
| Write endpoints (`POST /identity/create`) | 60 req/min per IP |
| Lender endpoints (`POST /lender/verify`) | 100 req/min per IP |

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1625097600
```

---

## Identity Endpoints

### `GET /api/v1/identity/:address`

Resolve a `did:stellar` DID document.

**Auth:** None (public endpoint)

**Path parameters:**
- `address` (string, required): Stellar account address (`G...`)

**Response (200 OK):**
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://stellartrust.io/contexts/v1"
  ],
  "id": "did:stellar:GAHT...",
  "controller": "did:stellar:GAHT...",
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

**Errors:**
- `400 Bad Request`: Invalid Stellar address format
- `404 Not Found`: No DID exists for this address

---

### `POST /api/v1/identity/create`

Create a new DID for a Stellar account.

**Auth:** Optional (MVP)

**Request body:**
```json
{
  "address": "GAHT...",
  "publicKeyHex": "a3f2..." // optional — 32-byte Ed25519 public key
}
```

**Response (201 Created):** Full W3C DID document (same as `GET /identity/:address`)

**Errors:**
- `400 Bad Request`: Validation error (invalid address, malformed publicKeyHex)
- `403 Forbidden`: Authenticated account does not match requested address (when JWT is present)
- `409 Conflict`: DID already exists for this address

---

### `POST /api/v1/identity/credential`

Add a verifiable credential to an identity.

**Auth:** Optional (MVP) — issuer or account owner

**Request body:**
```json
{
  "ownerAddress": "GAHT...",
  "issuerAddress": "GCK3...",
  "credentialType": "KYCVerified",
  "credentialHash": "0x4a3b...", // optional — SHA-256 hash
  "ipfsCid": "Qm...",             // optional — IPFS content ID
  "expiresAt": 1748736000         // optional — Unix timestamp
}
```

**Credential types:** `KYCBasic`, `KYCVerified`, `ProofOfAddress`, `EmploymentVerification`, `IncomeVerification`, `EducationCertificate`, `BusinessRegistration`, `Custom:<value>`

**Response (201 Created):**
```json
{
  "id": "cred:0x4a3b...",
  "type": "KYCVerified",
  "issuer": "did:stellar:GCK3...",
  "issuedAt": 1717200000,
  "expiresAt": 1748736000,
  "credentialHash": "0x4a3b..."
}
```

**Errors:**
- `400 Bad Request`: Validation error
- `403 Forbidden`: Caller is not a registered issuer or the account owner

---

### `DELETE /api/v1/identity/credential/:id`

Revoke a credential.

**Auth:** Required (owner or issuer only)

**Path parameters:**
- `id` (string, required): Credential ID (hex string or `cred:0x...` format)

**Response (200 OK):**
```json
{
  "message": "Credential revoked successfully",
  "credentialId": "0x4a3b..."
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid JWT
- `403 Forbidden`: Caller is neither the owner nor the issuer
- `404 Not Found`: Credential does not exist
- `409 Conflict`: Credential already revoked

---

## Credit Score Endpoints

### `GET /api/v1/score/:address`

Get the current credit score for an address.

**Auth:** None (public endpoint)

**Path parameters:**
- `address` (string, required): Stellar account address

**Response (200 OK):**
```json
{
  "subject": "GAHT...",
  "score": 742,
  "rating": "Very Good",
  "components": {
    "paymentHistory": 780,
    "transactionVolume": 720,
    "accountLongevity": 710,
    "assetDiversity": 650,
    "crossBorderActivity": 600,
    "credentialCompleteness": 800
  },
  "dataPoints": 1247,
  "lastUpdated": "2025-06-15T12:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Invalid Stellar address
- `404 Not Found`: No score data found for this address

---

### `GET /api/v1/score/:address/history`

Get score history snapshots.

**Auth:** None

**Path parameters:**
- `address` (string, required)

**Query parameters:**
- `limit` (integer, optional, default: 20, max: 100): Number of snapshots to return
- `offset` (integer, optional, default: 0): Pagination offset

**Response (200 OK):**
```json
{
  "address": "GAHT...",
  "history": [
    {
      "score": 742,
      "rating": "Very Good",
      "components": { ... },
      "dataPoints": 1247,
      "snapshotAt": "2025-06-15T12:00:00Z"
    },
    {
      "score": 735,
      "rating": "Good",
      "components": { ... },
      "dataPoints": 1198,
      "snapshotAt": "2025-06-01T08:30:00Z"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

---

### `GET /api/v1/score/:address/report`

Get a full credit report (score + history + credentials).

**Auth:** None

**Response (200 OK):**
```json
{
  "subject": "GAHT...",
  "score": 742,
  "rating": "Very Good",
  "components": { ... },
  "dataPoints": 1247,
  "lastUpdated": "2025-06-15T12:00:00Z",
  "history": [ ... ],
  "verifiedCredentials": ["KYCVerified", "ProofOfAddress"]
}
```

---

## Lender Endpoints

### `POST /api/v1/lender/verify`

Verify a borrower's identity and credit score. Primary integration point for lenders.

**Auth:** Optional (MVP)

**Request body:**
```json
{
  "address": "GAHT...",
  "requiredScore": 650,
  "requiredCredentials": ["KYCVerified", "ProofOfAddress"]
}
```

**Response (200 OK):**
```json
{
  "approved": true,
  "address": "GAHT...",
  "score": 742,
  "rating": "Very Good",
  "scoreApproved": true,
  "credentialsVerified": true,
  "requiredScore": 650,
  "requiredCredentials": ["KYCVerified", "ProofOfAddress"],
  "verifiedCredentials": ["KYCVerified", "ProofOfAddress", "EmploymentVerification"],
  "lastUpdated": "2025-06-15T12:00:00Z"
}
```

**`approved` logic:**
- `approved = scoreApproved AND credentialsVerified`
- `scoreApproved = (score >= requiredScore)`
- `credentialsVerified = (all items in requiredCredentials are present in verifiedCredentials)`

**Errors:**
- `400 Bad Request`: Invalid address or validation error

---

## Registry Endpoints

### `GET /api/v1/registry/issuers`

List all registered trusted issuers.

**Auth:** None

**Query parameters:**
- `active` (boolean, optional): Filter by active status

**Response (200 OK):**
```json
{
  "issuers": [
    {
      "address": "GCK3...",
      "name": "Smile Identity (KYC)",
      "url": "https://smileidentity.com",
      "credentialTypes": ["KYCBasic", "KYCVerified", "ProofOfAddress"],
      "registeredAt": "2025-01-01T00:00:00Z",
      "active": true
    }
  ]
}
```

---

### `GET /api/v1/registry/schemas`

List all registered credential schemas (Phase 2).

**Auth:** None

**Response (200 OK):**
```json
{
  "schemas": [
    {
      "id": "schema:kyc-verified-v1",
      "type": "KYCVerified",
      "version": "1.0",
      "jsonLdContext": "https://stellartrust.io/schemas/kyc-verified-v1.jsonld"
    }
  ]
}
```

---

## Webhook Endpoints

### `POST /api/v1/webhooks/soroban`

Internal endpoint for receiving Soroban contract events from the indexer. Not exposed publicly.

---

## Error Responses

All error responses follow the format:

```json
{
  "error": "Human-readable error message",
  "details": [ ... ]  // optional — validation error details (Zod output)
}
```

**HTTP status codes:**
- `400 Bad Request`: Invalid input (validation failure)
- `401 Unauthorized`: Missing or invalid JWT
- `403 Forbidden`: Authenticated but insufficient permissions
- `404 Not Found`: Resource does not exist
- `409 Conflict`: Resource already exists or state conflict
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
