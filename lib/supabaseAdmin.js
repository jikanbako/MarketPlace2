import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY. Uses the service role key, which bypasses Row Level
// Security — never import this from a component or page that runs in
// the browser, and never give the key a NEXT_PUBLIC_ prefix.
//
// Created lazily (on first use, not at import time) so the build
// doesn't fail on a machine where the key isn't set yet.
let client = null;

export function getAdmin() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Server is missing SUPABASE_SERVICE_ROLE_KEY');
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

// Identifies the logged-in user from the "Authorization: Bearer <jwt>"
// header the browser sends. Returns null if missing or invalid.
export async function getUserFromRequest(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await getAdmin().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
