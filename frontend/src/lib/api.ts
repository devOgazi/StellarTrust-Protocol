// API client — placeholder.
export const apiClient = {
  get: async (path: string) => fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`),
  post: async (path: string, body: unknown) =>
    fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};
