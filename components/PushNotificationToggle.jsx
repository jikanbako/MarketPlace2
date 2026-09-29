'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Converts the VAPID public key (base64url, no padding) into the
// Uint8Array format the PushManager API requires.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushNotificationToggle() {
  const [status, setStatus] = useState('checking'); // checking | unsupported | off | on | busy
  const [error, setError] = useState(null);

  useEffect(() => {
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? 'on' : 'off');
    }
    check();
  }, []);

  async function enable() {
    setError(null);
    setStatus('busy');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('off');
        setError('Notifications permission was not granted.');
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatus('off');
        setError('Push isn\u2019t configured on this deployment yet.');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('off');
        setError('Log in first.');
        return;
      }

      const json = subscription.toJSON();
      const { error: dbError } = await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
      });

      if (dbError && !dbError.message.includes('duplicate')) {
        setError(dbError.message);
      }

      setStatus('on');
    } catch (err) {
      setError(err.message);
      setStatus('off');
    }
  }

  async function disable() {
    setError(null);
    setStatus('busy');

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('off');
    } catch (err) {
      setError(err.message);
      setStatus('on');
    }
  }

  if (status === 'unsupported') return null;
  if (status === 'checking') return null;

  return (
    <section className="mb-10">
      <h2 className="font-display text-lg mb-3">Notifications</h2>
      <p className="text-sm text-ink/60 mb-3">
        Get notified about new messages, followers, comments, and store
        verification updates — even when BuyLink isn't open.
      </p>
      {error && <p className="text-clay text-sm mb-2">{error}</p>}
      {status === 'on' ? (
        <button
          onClick={disable}
          className="border border-ink/20 px-5 py-2 rounded-md text-sm"
        >
          Turn off notifications
        </button>
      ) : (
        <button
          onClick={enable}
          disabled={status === 'busy'}
          className="bg-ink text-sand px-5 py-2 rounded-md text-sm disabled:opacity-50"
        >
          {status === 'busy' ? 'Enabling…' : 'Enable notifications'}
        </button>
      )}
    </section>
  );
}
