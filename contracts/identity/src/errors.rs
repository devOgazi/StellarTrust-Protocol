//! Custom error types for the StellarTrust Identity contract.
//!
//! Each variant maps to a unique `u32` discriminant so that callers can
//! interpret failures returned from Soroban contract invocations.

use soroban_sdk::contracterror;

/// Errors that can be returned by the Identity contract.
#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum IdentityError {
    /// The caller is not a registry-trusted issuer for the given
    /// credential type.
    UnauthorizedIssuer = 1,

    /// No credential with the supplied `CredentialId` exists on this DID.
    CredentialNotFound = 2,

    /// The referenced credential's expiry timestamp is in the past.
    ExpiredCredential = 3,

    /// A DID already exists for the requesting account; duplicate creation
    /// is not permitted.
    DuplicateDID = 4,

    /// The target DID document does not exist.
    DIDNotFound = 5,

    /// The credential list for this DID has reached the protocol maximum.
    CredentialLimitReached = 6,

    /// The attestation list for this subject has reached the protocol maximum.
    AttestationLimitReached = 7,
}
