.PHONY: build test test-integration deploy-testnet deploy-mainnet fmt lint

build:
	cargo build --target wasm32-unknown-unknown --release

test:
	cargo test

test-integration:
	cargo test --features integration

fmt:
	cargo fmt --all

lint:
	cargo clippy --all-targets --all-features -- -D warnings

deploy-testnet:
	@echo "Deploy contracts to Stellar testnet — configure STELLAR_SECRET_KEY first."

deploy-mainnet:
	@echo "Deploy contracts to Stellar mainnet — requires governance approval and multisig."
