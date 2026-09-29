import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// This route is called from inside Postgres (via the pg_net extension,
// see supabase/schema.sql's notify_push() function), not from the
// browser. It's protected by a shared secret header rather than a user
// session, since there is no user session at that point — it's the
// database itself making the request.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-only — bypasses RLS to read subscriptions
);

webpush.setVapidDetails(
  'mailto:support@example.com', // replace with a real contact address
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function POST(request) {
  const secret = request.headers.get('x-push-secret');
  if (!secret || secret !== process.env.PUSH_API_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user_id, title, body, url } = await request.json();
  if (!user_id || !title) {
    return Response.json({ error: 'Missing user_id or title' }, { status: 400 });
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user_id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  if (!subscriptions || subscriptions.length === 0) {
    return Response.json({ sent: 0 });
  }

  const payload = JSON.stringify({ title, body: body || '', url: url || '/' });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        payload
      )
    )
  );

  // A 404/410 means the browser unsubscribed or the subscription
  // expired — clean those up so we stop trying to send to them.
  const deadEndpoints = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const statusCode = result.reason?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadEndpoints.push(subscriptions[i].endpoint);
      }
    }
  });

  if (deadEndpoints.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return Response.json({ sent, removed: deadEndpoints.length });
}
