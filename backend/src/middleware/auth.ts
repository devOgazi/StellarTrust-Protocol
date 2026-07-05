/**
 * SEP-0010 JWT Authentication Middleware
 *
 * Implements the SEP-0010 Stellar Web Authentication protocol:
 *   https://stellar.org/protocol/sep-10
 *
 * Flow:
 *   1. GET /auth?account=G...              → returns a challenge transaction
 *   2. POST /auth { account, transaction } → client submits signed tx
 *                                           → server returns JWT
 *   3. All protected routes require: Authorization: Bearer <jwt>
 *
 * The challenge transaction is a Stellar transaction containing a
 * manage_data operation signed by the server's account.  The client
 * countersigns with their account keypair and submits it back.  The server
 * verifies the signature, then issues a short-lived JWT.
 */

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import {
  TransactionBuilder,
  Networks,
  Operation,
  Keypair,
  Transaction,
  StrKey,
} from '@stellar/stellar-sdk';
import { isValidStellarAddress, NETWORK_PASSPHRASE } from '../utils/stellar';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET ?? 'stellartrust-dev-secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
const CHALLENGE_TIMEOUT = 300; // 5 minutes for the client to sign

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JWTPayload {
  sub: string;   // Stellar account address
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  account?: string;  // Set by requireAuth middleware
}

// ---------------------------------------------------------------------------
// SEP-0010 Challenge generation
// ---------------------------------------------------------------------------

/**
 * Builds a SEP-0010 challenge transaction for the given `account`.
 *
 * The transaction must be signed by the client and returned to /auth POST.
 * Returns the base64-encoded XDR of the unsigned challenge transaction.
 */
export function buildChallenge(account: string): {
  transaction: string;
  network_passphrase: string;
} {
  if (!isValidStellarAddress(account)) {
    throw new Error(`Invalid Stellar account address: ${account}`);
  }

  // Server keypair — in production this should be a dedicated auth keypair,
  // not the main service keypair.
  const serverKeypair = getServerKeypair();

  // Random nonce (32 bytes → base64)
  const nonce = Buffer.from(
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)),
  ).toString('base64');

  const now = Math.floor(Date.now() / 1000);

  // Build the challenge tx.  SEP-0010 requires:
  //   - source: server account
  //   - sequence number: 0 (so it can never be submitted)
  //   - time bounds: [now, now + CHALLENGE_TIMEOUT]
  //   - manage_data op: source = client account, name = "<domain> auth"
  const challengeTx = new TransactionBuilder(
    {
      accountId: () => serverKeypair.publicKey(),
      sequenceNumber: () => '0',
      incrementSequenceNumber: () => {},
    } as any, // minimal mock account for sequence 0
    {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    },
  )
    .addOperation(
      Operation.manageData({
        name: 'stellartrust.io auth',
        value: Buffer.from(nonce, 'base64'),
        source: account,
      }),
    )
    .addMemo({ type: 'none' } as any)
    .setTimebounds(now, now + CHALLENGE_TIMEOUT)
    .build();

  // Server countersigns the challenge
  challengeTx.sign(serverKeypair);

  return {
    transaction: challengeTx.toEnvelope().toXDR('base64'),
    network_passphrase: NETWORK_PASSPHRASE,
  };
}

// ---------------------------------------------------------------------------
// SEP-0010 Challenge verification → JWT issuance
// ---------------------------------------------------------------------------

/**
 * Verifies a signed SEP-0010 challenge transaction and returns a JWT.
 *
 * Steps:
 *  1. Deserialise the XDR transaction
 *  2. Verify server signature is present
 *  3. Verify client account signature is present
 *  4. Check time bounds have not expired
 *  5. Issue a JWT for the client account
 */
export function verifyChallengeAndIssueJWT(
  account: string,
  transactionXdr: string,
): string {
  if (!isValidStellarAddress(account)) {
    throw new Error(`Invalid Stellar account: ${account}`);
  }

  let tx: Transaction;
  try {
    tx = new Transaction(transactionXdr, NETWORK_PASSPHRASE);
  } catch (err) {
    throw new Error(`Invalid transaction XDR: ${(err as Error).message}`);
  }

  // Check time bounds
  const now = Math.floor(Date.now() / 1000);
  const timeBounds = tx.timeBounds;
  if (!timeBounds) throw new Error('Challenge transaction missing time bounds');
  if (now > Number(timeBounds.maxTime)) {
    throw new Error('Challenge transaction has expired');
  }
  if (now < Number(timeBounds.minTime)) {
    throw new Error('Challenge transaction is not yet valid');
  }

  // Verify the operation is a manage_data op sourced from the client account
  const op = tx.operations[0];
  if (op?.type !== 'manageData') {
    throw new Error('Challenge transaction must contain a manageData operation');
  }
  if (op.source !== account) {
    throw new Error('manageData operation source does not match account');
  }

  // Verify both server and client signatures
  const serverKeypair = getServerKeypair();
  const txHash = tx.hash();

  let serverSigned = false;
  let clientSigned = false;

  for (const sig of tx.signatures) {
    const hint = sig.signature().slice(0, 4);
    if (hint.equals(serverKeypair.rawPublicKey().slice(-4))) {
      serverSigned = serverKeypair.verify(txHash, sig.signature());
    }
    try {
      const clientKp = Keypair.fromPublicKey(account);
      if (hint.equals(clientKp.rawPublicKey().slice(-4))) {
        clientSigned = clientKp.verify(txHash, sig.signature());
      }
    } catch {
      // Skip invalid signature hints
    }
  }

  if (!serverSigned) throw new Error('Server signature missing from challenge');
  if (!clientSigned) throw new Error('Client account signature missing');

  // Issue JWT
  return issueJWT(account);
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/**
 * Issues a signed JWT for the given Stellar account address.
 */
export function issueJWT(account: string): string {
  return jwt.sign({ sub: account }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  } as jwt.SignOptions);
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws if the token is invalid or expired.
 */
export function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware that enforces a valid JWT in the Authorization header.
 *
 * Sets `req.account` to the Stellar address on success.
 * Returns 401 on missing / invalid / expired token.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyJWT(token);
    req.account = payload.sub;
    next();
  } catch (err) {
    res.status(401).json({ error: `Invalid or expired token: ${(err as Error).message}` });
  }
}

/**
 * Soft auth middleware — attaches `req.account` if a valid JWT is present,
 * but does NOT reject the request if the header is absent.
 * Useful for endpoints that have both authenticated and public paths.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyJWT(authHeader.slice(7));
      req.account = payload.sub;
    } catch {
      // Ignore invalid optional token
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServerKeypair(): Keypair {
  // In production, load from a KMS or environment secret.
  // For development, derive a deterministic key from JWT_SECRET.
  const secret = process.env.SERVER_AUTH_SECRET;
  if (secret && StrKey.isValidEd25519SecretSeed(secret)) {
    return Keypair.fromSecret(secret);
  }
  // Fallback: derive from JWT_SECRET hash (dev only)
  const hash = Buffer.from(
    require('crypto').createHash('sha256').update(JWT_SECRET).digest(),
  );
  // Ed25519 seeds are 32 bytes
  return Keypair.fromRawEd25519Seed(hash);
}
