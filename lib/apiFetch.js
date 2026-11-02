import { supabase } from '@/lib/supabaseClient';

// Browser helper: calls one of our own /api routes with the current
// user's session token attached, and throws a readable Error on failure.
export async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong');
  return json;
}
