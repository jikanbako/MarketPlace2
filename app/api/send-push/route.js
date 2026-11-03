import webpush from 'web-push';
import { getAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Called from inside Postgres (pg_net, see notify_push() in schema.sql),
// not from the browser. Protected by a shared secret header because
// there's no user session — it's the database itself calling.

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    'mailto:support@example.com', // replace with a real contact address
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
}

export async function POST(request) {
  const secret = request.headers.get('x-push-secret');
  if (!secret || secret !== process.env.PUSH_API_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user_id, title, body, url } = await request.json();
  if (!user_id || !title) {
    return Response.json({ error: 'Missing user_id or title' }, { status: 400 });
  }

  try {
    ensureVapid();
  } catch (err) {
    return Response.json({ error: 'Push is not configured on the server' }, { status: 500 });
  }

  const admin = getAdmin();
  const { data: subscriptions, error } = await admin
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
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload
      )
    )
  );

  // 404/410 = the browser unsubscribed or the subscription expired
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
    await admin.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return Response.json({ sent, removed: deadEndpoints.length });
}
