#!/usr/bin/env bash
# scripts/deploy-contracts.sh
#
# Build and deploy all StellarTrust Soroban contracts to the target network
# (default: testnet).  After deployment, patch contract IDs into the backend
# and frontend .env files so the rest of the stack can use them immediately.
#
# Prerequisites:
#   - stellar-cli installed (cargo install --locked stellar-cli --features opt)
#   - STELLAR_SECRET_KEY exported (or in .env)
#   - Rust + wasm32-unknown-unknown target installed
#
# Usage:
#   STELLAR_SECRET_KEY=<key> ./scripts/deploy-contracts.sh [testnet|mainnet]
#
# Examples:
#   ./scripts/deploy-contracts.sh               # deploys to testnet
#   ./scripts/deploy-contracts.sh mainnet       # deploys to mainnet

set -euo pipefail

NETWORK="${1:-testnet}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$REPO_ROOT/contracts"
BACKEND_ENV="$REPO_ROOT/backend/.env"
FRONTEND_ENV="$REPO_ROOT/frontend/.env.local"

# ── Validate prerequisites ────────────────────────────────────────────────────

if ! command -v stellar &>/dev/null; then
  echo "ERROR: stellar-cli not found."
  echo "Install it with: cargo install --locked stellar-cli --features opt"
  exit 1
fi

if [[ -z "${STELLAR_SECRET_KEY:-}" ]]; then
  echo "ERROR: STELLAR_SECRET_KEY is not set."
  echo "Export it before running this script:"
  echo "  export STELLAR_SECRET_KEY=S..."
  exit 1
fi

# ── Derive deployer public key ────────────────────────────────────────────────

DEPLOYER_PUB=$(stellar keys public-key --secret-key "$STELLAR_SECRET_KEY" 2>/dev/null || true)
echo "Deployer:  ${DEPLOYER_PUB:-(unknown)}"
echo "Network:   $NETWORK"
echo ""

# ── Build all contracts ───────────────────────────────────────────────────────

echo "==> Building Soroban contracts (wasm32-unknown-unknown, release)..."
(
  cd "$CONTRACTS_DIR"
  cargo build --target wasm32-unknown-unknown --release 2>&1
)
echo ""

WASM_DIR="$CONTRACTS_DIR/target/wasm32-unknown-unknown/release"

# ── Helper: deploy a single contract ─────────────────────────────────────────

deploy_contract() {
  local name="$1"
  local wasm="$WASM_DIR/$2"

  if [[ ! -f "$wasm" ]]; then
    echo "ERROR: WASM not found: $wasm"
    exit 1
  fi

  echo "==> Uploading $name contract bytecode..."
  WASM_HASH=$(stellar contract upload \
    --wasm "$wasm" \
    --source "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    2>&1 | tail -1)
  echo "    wasm hash: $WASM_HASH"

  echo "==> Deploying $name contract instance..."
  CONTRACT_ID=$(stellar contract deploy \
    --wasm-hash "$WASM_HASH" \
    --source "$STELLAR_SECRET_KEY" \
    --network "$NETWORK" \
    2>&1 | tail -1)
  echo "    contract ID: $CONTRACT_ID"
  echo ""

  echo "$CONTRACT_ID"
}

# ── Deploy each contract ──────────────────────────────────────────────────────

echo "=== Deploying Registry contract first (Identity depends on it) ==="
REGISTRY_CONTRACT_ID=$(deploy_contract "Registry" "stellartrust_registry.wasm")

echo "=== Deploying Identity contract ==="
IDENTITY_CONTRACT_ID=$(deploy_contract "Identity" "stellartrust_identity.wasm")

echo "=== Deploying Credit Score contract ==="
SCORE_CONTRACT_ID=$(deploy_contract "CreditScore" "stellartrust_credit_score.wasm")

# ── Summary ───────────────────────────────────────────────────────────────────

echo "============================================================"
echo "Deployment complete ($NETWORK)"
echo "  IDENTITY_CONTRACT_ID  = $IDENTITY_CONTRACT_ID"
echo "  SCORE_CONTRACT_ID     = $SCORE_CONTRACT_ID"
echo "  REGISTRY_CONTRACT_ID  = $REGISTRY_CONTRACT_ID"
echo "============================================================"
echo ""

# ── Patch .env files ──────────────────────────────────────────────────────────

patch_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  if [[ ! -f "$file" ]]; then
    echo "  SKIP: $file does not exist — copy the .env.example first."
    return
  fi

  if grep -q "^${key}=" "$file"; then
    # Replace existing key
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    # Append missing key
    echo "${key}=${value}" >> "$file"
  fi
  echo "  Patched $key in $file"
}

echo "==> Updating .env files with contract IDs..."

patch_env "$BACKEND_ENV" "IDENTITY_CONTRACT_ID"  "$IDENTITY_CONTRACT_ID"
patch_env "$BACKEND_ENV" "SCORE_CONTRACT_ID"      "$SCORE_CONTRACT_ID"
patch_env "$BACKEND_ENV" "REGISTRY_CONTRACT_ID"   "$REGISTRY_CONTRACT_ID"

patch_env "$FRONTEND_ENV" "NEXT_PUBLIC_IDENTITY_CONTRACT_ID"  "$IDENTITY_CONTRACT_ID"
patch_env "$FRONTEND_ENV" "NEXT_PUBLIC_SCORE_CONTRACT_ID"      "$SCORE_CONTRACT_ID"
patch_env "$FRONTEND_ENV" "NEXT_PUBLIC_REGISTRY_CONTRACT_ID"   "$REGISTRY_CONTRACT_ID"

echo ""
echo "Done. Restart your backend and rebuild the frontend to pick up the new IDs."
