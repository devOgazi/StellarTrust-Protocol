// Identity verification client — placeholder.
import { StellarTrustConfig, DIDDocument } from './types';

export class IdentityClient {
  constructor(private config: StellarTrustConfig) {}

  async resolve(_address: string): Promise<DIDDocument> {
    throw new Error('Not implemented');
  }
}
