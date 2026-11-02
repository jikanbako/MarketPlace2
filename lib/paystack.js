// SERVER-ONLY thin wrapper around the Paystack REST API.
const BASE = 'https://api.paystack.co';

export function isTestMode() {
  return (process.env.PAYSTACK_SECRET_KEY || '').startsWith('sk_test_');
}

export async function paystack(path, { method = 'GET', body } = {}) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set on the server');

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false) {
    throw new Error(json.message || `Paystack request failed (${res.status})`);
  }
  return json.data;
}
