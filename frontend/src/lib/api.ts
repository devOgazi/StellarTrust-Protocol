const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API request failed: ${res.status}`);
  }
  return res.json();
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },

  async resolveDID(address: string) {
    return this.get<import('@/types').DIDDocument>(`/identity/${address}`);
  },

  async createDID(address: string, publicKeyHex?: string) {
    return this.post<import('@/types').DIDDocument>('/identity/create', {
      address,
      publicKeyHex,
    });
  },

  async addCredential(data: {
    ownerAddress: string;
    issuerAddress: string;
    credentialType: string;
    credentialHash?: string;
    ipfsCid?: string;
    expiresAt?: number;
  }) {
    return this.post('/identity/credential', data);
  },

  async revokeCredential(id: string) {
    const credentialId = id.startsWith('cred:') ? id.slice(5) : id;
    return this.delete(`/identity/credential/${credentialId}`);
  },

  async getScore(address: string) {
    return this.get<import('@/types').CreditScore>(`/score/${address}`);
  },

  async getScoreHistory(address: string, limit = 20, offset = 0) {
    return this.get(`/score/${address}/history?limit=${limit}&offset=${offset}`);
  },

  async getScoreReport(address: string) {
    return this.get(`/score/${address}/report`);
  },

  async lenderVerify(data: {
    address: string;
    requiredScore?: number;
    requiredCredentials?: string[];
  }) {
    return this.post('/lender/verify', data);
  },

  async getIssuers() {
    return this.get('/registry/issuers');
  },

  async getSchemas() {
    return this.get('/registry/schemas');
  },
};
