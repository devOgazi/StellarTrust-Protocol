# Integration Guide

This guide shows lenders, DeFi protocols, and other third-party applications how to integrate StellarTrust's identity and credit scoring infrastructure.

---

## Table of Contents

- [Quick Start (Lender SDK)](#quick-start-lender-sdk)
- [Use Case: Lending Protocol](#use-case-lending-protocol)
- [Use Case: KYC Provider](#use-case-kyc-provider)
- [Direct API Integration](#direct-api-integration)
- [Frontend Integration](#frontend-integration)
- [Testing](#testing)
- [Production Checklist](#production-checklist)

---

## Quick Start (Lender SDK)

The `@stellartrust/sdk` package provides a TypeScript client for querying identity and credit scores.

### Installation

```bash
npm install @stellartrust/sdk
# or
yarn add @stellartrust/sdk
```

### Basic Usage

```typescript
import { StellarTrust } from '@stellartrust/sdk';

// Initialize the client
const client = new StellarTrust({
  network: 'mainnet',  // or 'testnet'
  apiKey: process.env.STELLARTRUST_API_KEY, // optional — higher rate limits
});

// Verify a borrower before issuing a loan
async function verifyBorrower(address: string) {
  const result = await client.lender.verify({
    address,
    requiredScore: 650,
    requiredCredentials: ['KYCVerified'],
  });

  if (result.approved) {
    console.log(`✓ Approved — Score: ${result.score}`);
    return true;
  } else {
    console.log(`✗ Denied — Score: ${result.score || 'N/A'}`);
    return false;
  }
}

// Example: Stellar Turrets loan flow
const borrowerAddress = 'GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ';
const approved = await verifyBorrower(borrowerAddress);

if (approved) {
  // Issue loan via your protocol
  await issueLoan(borrowerAddress, { amount: 1000, term: 30 });
}
```

---

## Use Case: Lending Protocol

**Scenario:** You're building a peer-to-peer lending protocol on Stellar. Borrowers apply for loans, and you want to assess creditworthiness before approving.

### Integration Flow

```
1. Borrower connects Freighter wallet → provides Stellar address
2. Your backend calls StellarTrust lender.verify()
3. If approved:
     a. Escrow borrower's collateral (if any) via Soroban contract
     b. Transfer loan principal from lender → borrower
     c. Record loan terms on-chain
4. On repayment:
     a. Call StellarTrust score.recordRepayment() to update credit history
5. On default:
     a. Call StellarTrust score.recordDefault()
```

### Code Example

```typescript
import { StellarTrust } from '@stellartrust/sdk';
import { Keypair, TransactionBuilder, Operation } from '@stellar/stellar-sdk';

const trustClient = new StellarTrust({ network: 'mainnet' });

async function processLoanApplication(borrowerAddress: string, loanAmount: number) {
  // Step 1: Verify identity and credit
  const verification = await trustClient.lender.verify({
    address: borrowerAddress,
    requiredScore: 600,  // Minimum score for approval
    requiredCredentials: ['KYCVerified', 'ProofOfAddress'],
  });

  if (!verification.approved) {
    throw new Error(`Loan denied: Score too low or missing credentials`);
  }

  console.log(`Borrower verified: ${verification.score} (${verification.rating})`);

  // Step 2: Issue the loan (simplified — real implementation uses Soroban contracts)
  const loanId = await issueLoan({
    borrower: borrowerAddress,
    amount: loanAmount,
    term: 30, // days
    interestRate: calculateInterestRate(verification.score),
  });

  return { loanId, score: verification.score };
}

function calculateInterestRate(score: number): number {
  // Example risk-based pricing
  if (score >= 800) return 0.05;  // 5% APR
  if (score >= 740) return 0.08;  // 8% APR
  if (score >= 670) return 0.12;  // 12% APR
  return 0.18;                     // 18% APR for scores < 670
}
```

### Recording Repayments

```typescript
import { Contract, SorobanRpc } from '@stellar/stellar-sdk';

async function recordRepayment(
  loanId: string,
  borrowerAddress: string,
  amount: number,
  onTime: boolean
) {
  // Call the StellarTrust Score contract to record the event
  const scoreContractId = process.env.STELLARTRUST_SCORE_CONTRACT_ID;
  const lenderKeypair = Keypair.fromSecret(process.env.LENDER_SECRET_KEY);

  const contract = new Contract(scoreContractId);
  const tx = new TransactionBuilder(/* ... */)
    .addOperation(
      contract.call('record_repayment', [
        /* lender address */,
        /* borrower address */,
        /* amount as ScVal */,
        /* onTime as ScVal */,
        /* asset as ScVal */,
      ])
    )
    .build();

  tx.sign(lenderKeypair);

  const rpc = new SorobanRpc.Server(process.env.STELLAR_RPC_URL);
  const result = await rpc.sendTransaction(tx);

  console.log(`Repayment recorded for ${borrowerAddress}: ${amount} USDC`);
}
```

---

## Use Case: KYC Provider

**Scenario:** You're a KYC verification provider (like Smile Identity or Sumsub). After a user passes KYC, you issue a credential to their StellarTrust DID.

### Integration Flow

```
1. User completes KYC verification via your platform
2. Your backend receives "KYC Pass" webhook
3. Call StellarTrust API: POST /api/v1/identity/credential
4. Store the credential payload on IPFS (encrypted with user's public key)
5. Store the credential hash + IPFS CID on-chain
```

### Code Example

```typescript
import { StellarTrust } from '@stellartrust/sdk';
import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import { createHash } from 'crypto';

const trustClient = new StellarTrust({
  network: 'mainnet',
  issuerSecretKey: process.env.ISSUER_SECRET_KEY, // Your issuer keypair
});

async function issueKYCCredential(userAddress: string, kycData: object) {
  // Step 1: Encrypt and upload KYC data to IPFS
  const ipfs = await createHelia();
  const fs = unixfs(ipfs);

  const encryptedPayload = encryptWithPublicKey(
    JSON.stringify(kycData),
    userAddress  // Stellar public key used for encryption
  );

  const cid = await fs.addBytes(Buffer.from(encryptedPayload));
  console.log(`KYC payload uploaded to IPFS: ${cid}`);

  // Step 2: Compute SHA-256 hash of the payload
  const hash = createHash('sha256').update(encryptedPayload).digest('hex');

  // Step 3: Add credential to user's DID via StellarTrust API
  await trustClient.identity.addCredential({
    ownerAddress: userAddress,
    issuerAddress: trustClient.issuerAddress,
    credentialType: 'KYCVerified',
    credentialHash: `0x${hash}`,
    ipfsCid: cid.toString(),
    expiresAt: Math.floor(Date.now() / 1000) + 31536000, // 1 year expiry
  });

  console.log(`KYCVerified credential issued to ${userAddress}`);
}

// Helper: encrypt data with the user's Stellar Ed25519 public key
function encryptWithPublicKey(data: string, stellarPublicKey: string): string {
  // Convert Ed25519 → Curve25519, then ECDH + AES-256-GCM
  // Implementation depends on your crypto library (libsodium, tweetnacl, etc.)
  // ...
  return encryptedData;
}
```

---

## Direct API Integration

If you're not using TypeScript or prefer direct HTTP calls, you can integrate via REST:

### Example: Verify Borrower (cURL)

```bash
curl -X POST https://api.stellartrust.io/api/v1/lender/verify \
  -H "Content-Type: application/json" \
  -d '{
    "address": "GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ",
    "requiredScore": 650,
    "requiredCredentials": ["KYCVerified"]
  }'
```

**Response:**
```json
{
  "approved": true,
  "score": 742,
  "rating": "Very Good",
  "scoreApproved": true,
  "credentialsVerified": true,
  "verifiedCredentials": ["KYCVerified", "ProofOfAddress"]
}
```

### Example: Resolve DID (cURL)

```bash
curl https://api.stellartrust.io/api/v1/identity/GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ
```

**Response:** W3C DID Document (see [API Reference](./api-reference.md#get-apiv1identityaddress))

---

## Frontend Integration

For user-facing applications (wallets, DeFi frontends), integrate with the React hooks provided in the `frontend/src/hooks/` directory.

### Example: Display User's Credit Score

```tsx
'use client';

import { useCreditScore } from '@/hooks/useCreditScore';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { ScoreGauge } from '@/components/score';

export default function ProfilePage() {
  const { address } = useStellarWallet();
  const { score, loading, error, refresh } = useCreditScore();

  useEffect(() => {
    if (address) {
      refresh(address);
    }
  }, [address, refresh]);

  if (loading) return <p>Loading score...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Your Credit Score</h1>
      {score && <ScoreGauge score={score.score} size="lg" />}
      <p>Rating: {score?.rating}</p>
    </div>
  );
}
```

---

## Testing

### Testnet Setup

1. Create a Stellar testnet account: https://laboratory.stellar.org/#account-creator
2. Fund it with testnet XLM from the Friendbot
3. Deploy the StellarTrust contracts to testnet (or use the public testnet deployment)
4. Point your SDK client to `network: 'testnet'`

### Mock Data

For unit tests, use the mock helpers provided in `backend/tests/helpers.ts`:

```typescript
import { createMockPrisma, TEST_ADDRESS } from './helpers';

const prisma = createMockPrisma();

// Seed test data
prisma._seed.addIdentity({ address: TEST_ADDRESS });
prisma._seed.addSnapshot({ address: TEST_ADDRESS, score: 750 });

// Now query
const identity = await prisma.identity.findUnique({ where: { address: TEST_ADDRESS } });
```

---

## Production Checklist

Before going live with a StellarTrust integration:

### Backend
- [ ] Configure `STELLAR_NETWORK=mainnet` and `STELLAR_RPC_URL=https://soroban-mainnet.stellar.org`
- [ ] Set real contract IDs (`IDENTITY_CONTRACT_ID`, `SCORE_CONTRACT_ID`, `REGISTRY_CONTRACT_ID`)
- [ ] Use production Postgres/Redis instances with backups
- [ ] Rotate `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` to strong random values
- [ ] Enable TLS on all API endpoints (Nginx reverse proxy)
- [ ] Set up monitoring (Prometheus + Grafana or Datadog)

### Frontend
- [ ] Set `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`
- [ ] Set `NEXT_PUBLIC_API_URL=https://api.stellartrust.io/api/v1`
- [ ] Build with production contract IDs (`NEXT_PUBLIC_IDENTITY_CONTRACT_ID`, etc.)
- [ ] Enable Freighter wallet production mode

### Contracts
- [ ] Deploy via the governance-approved process (3-of-5 multisig + 48-hour timelock)
- [ ] Register your lender/issuer address in the Registry contract on-chain
- [ ] Test all contract functions on testnet first

### Compliance
- [ ] Review your jurisdiction's regulations for credit reporting
- [ ] Ensure user consent flows for credential issuance
- [ ] Implement GDPR/CCPA data deletion workflows (off-chain only; on-chain is immutable)

---

For further help, join our [Discord](https://discord.gg/stellartrust) or email [support@stellartrust.io](mailto:support@stellartrust.io).
