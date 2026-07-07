#!/usr/bin/env ts-node
// scripts/seed-issuers.ts
//
// Seeds initial trusted issuers into the Registry contract and the backend DB.
// Issuers are organizations or entities authorised to issue verifiable credentials.
//
// Prerequisites:
//   - Deployed Registry contract (REGISTRY_CONTRACT_ID in backend/.env)
//   - Backend DB available (DATABASE_URL in backend/.env)
//   - Admin account funded on testnet/mainnet (can invoke registry.register_issuer)
//
// Usage:
//   cd scripts && npx ts-node seed-issuers.ts

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Keypair } from '@stellar/stellar-sdk';

// ── Configuration ─────────────────────────────────────────────────────────────

interface IssuerSeed {
  name: string;
  address: string;
  url?: string;
  credentialTypes: string[];
}

const SEED_ISSUERS: IssuerSeed[] = [
  {
    name: 'StellarTrust Foundation',
    address: process.env.FOUNDATION_ISSUER_ADDRESS ?? 'GCSJ7MFIIGIRMAS4R3VT5FIFIAOXNMGDI5ZFYCS5FVKDIBZRP7MWDH3',
    url: 'https://stellartrust.io',
    credentialTypes: ['ANY'], // can issue any credential type
  },
  {
    name: 'Smile Identity (KYC)',
    address: process.env.SMILE_ISSUER_ADDRESS ?? 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGZIXRYUJ5XUTAWBPXC3HDXH1',
    url: 'https://smileidentity.com',
    credentialTypes: ['KYCBasic', 'KYCVerified', 'ProofOfAddress'],
  },
  {
    name: 'Global Trust Verifier',
    address: process.env.TRUST_ISSUER_ADDRESS ?? 'GAHTJRC4UI7CQNNZXR4E3I6A4UGWKIA3ZVJM5GQSYSDIZJXR3KBZJXQ',
    url: 'https://globaltrustverifier.example',
    credentialTypes: [
      'KYCVerified',
      'EmploymentVerification',
      'IncomeVerification',
      'EducationCertificate',
      'BusinessRegistration',
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== StellarTrust Issuer Seeding Script ===\n');

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('[✓] Connected to Postgres\n');

    // For MVP, we skip the on-chain contract invocation (requires a funded admin
    // account signing a transaction).  In production, each issuer must be registered
    // on-chain via registry.register_issuer() before being trusted.
    //
    // For now, we populate the backend DB so the backend recognises these issuers.

    for (const issuer of SEED_ISSUERS) {
      console.log(`Seeding issuer: ${issuer.name} (${issuer.address})`);

      // Validate address
      try {
        Keypair.fromPublicKey(issuer.address);
      } catch {
        console.error(`  ✗ Invalid Stellar address: ${issuer.address}`);
        continue;
      }

      await prisma.issuer.upsert({
        where: { address: issuer.address },
        create: {
          address: issuer.address,
          name: issuer.name,
          url: issuer.url ?? null,
          credentialTypes: issuer.credentialTypes,
          active: true,
        },
        update: {
          name: issuer.name,
          url: issuer.url ?? null,
          credentialTypes: issuer.credentialTypes,
          active: true,
        },
      });

      console.log(`  ✓ ${issuer.name} registered\n`);
    }

    console.log('=== Seeding complete ===');
    console.log(`Registered ${SEED_ISSUERS.length} issuers in the backend DB.`);
    console.log('For production, each issuer must also be registered on-chain.');
    console.log('');
  } catch (err) {
    console.error('ERROR:', (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute only when run directly
if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export { main, SEED_ISSUERS };
