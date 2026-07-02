#!/usr/bin/env bash
# Deploy all Soroban contracts to Stellar testnet.
set -euo pipefail

cd "$(dirname "$0")/../contracts"

echo "Building contracts..."
cargo build --target wasm32-unknown-unknown --release

echo "Deploying Identity contract..."
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellartrust_identity.wasm \
  --source "${STELLAR_SECRET_KEY:?STELLAR_SECRET_KEY not set}" \
  --network testnet

echo "Deploying Credit Score contract..."
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellartrust_credit_score.wasm \
  --source "${STELLAR_SECRET_KEY}" \
  --network testnet

echo "Deploying Registry contract..."
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellartrust_registry.wasm \
  --source "${STELLAR_SECRET_KEY}" \
  --network testnet

echo "Done. Update contract IDs in .env files."
