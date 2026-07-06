import { StellarTrustConfig, DIDDocument } from './types';

const DEFAULT_BASE_URL = 'https://api.stellartrust.io/api/v1';

export class IdentityClient {
  constructor(private config: StellarTrustConfig) {}

  private get baseUrl(): string {
    return this.config.baseUrl ?? DEFAULT_BASE_URL;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      h['X-API-Key'] = this.config.apiKey;
    }
    return h;
  }

  async resolve(address: string): Promise<DIDDocument> {
    const res = await fetch(
      `${this.baseUrl}/identity/${address}`,
      { headers: this.headers },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to resolve identity: ${res.status}`);
    }
    return res.json();
  }

  async create(address: string, publicKeyHex?: string): Promise<DIDDocument> {
    const res = await fetch(
      `${this.baseUrl}/identity/create`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ address, publicKeyHex }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Failed to create DID: ${res.status}`);
    }
    return res.json();
  }
}
