//! Shared library for StellarTrust Protocol contracts.
//!
//! Re-exports all shared types and constants used across the protocol's
//! Soroban smart contracts.

#![no_std]

pub mod constants;
pub mod types;

pub use constants::*;
pub use types::*;
