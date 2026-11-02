'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';

function VerifyInner() {
  const params = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const [status, setStatus] = useState('checking'); // checking | paid | pending | failed | error
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      setMessage('No payment reference found.');
      return;
    }

    let cancelled = false;
    let attempts = 0;

    // Paystack can take a few seconds to settle a transfer or bank
    // payment, so a "pending" answer is re-checked a few times before
    // we tell the buyer to check back later.
    async function check() {
      try {
        const result = await apiFetch(`/api/checkout/verify?reference=${encodeURIComponent(reference)}`);
        if (cancelled) return;

        if (result.status === 'pending' && attempts < 5) {
          attempts += 1;
          setTimeout(check, 3000);
          return;
        }
        setStatus(result.status);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err.message);
      }
    }
    check();

    return () => {
      cancelled = true;
    };
  }, [reference]);

  return (
    <div className="max-w-md mx-auto px-6 py-20 text-center">
      {status === 'checking' && (
        <>
          <h1 className="font-display text-2xl mb-2">Confirming your payment…</h1>
          <p className="text-ink/60">This only takes a moment. Please don't close this page.</p>
        </>
      )}

      {status === 'paid' && (
        <>
          <p className="text-4xl mb-3 text-moss">✓</p>
          <h1 className="font-display text-2xl mb-2">Payment received</h1>
          <p className="text-ink/60 mb-6">
            Thank you! The seller has been notified and will arrange delivery.
          </p>
          <a href="/orders" className="inline-block bg-ink text-sand px-6 py-3 rounded-md">
            View my orders
          </a>
        </>
      )}

      {status === 'pending' && (
        <>
          <h1 className="font-display text-2xl mb-2">Still waiting for confirmation</h1>
          <p className="text-ink/60 mb-6">
            Your payment hasn't been confirmed yet. If you were charged, it
            will show up in your orders shortly — you don't need to pay again.
          </p>
          <a href="/orders" className="underline">Check my orders</a>
        </>
      )}

      {status === 'failed' && (
        <>
          <h1 className="font-display text-2xl mb-2">Payment didn't go through</h1>
          <p className="text-ink/60 mb-6">You weren't charged. You can try again.</p>
          <a href="/cart" className="underline">Back to cart</a>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 className="font-display text-2xl mb-2">We couldn't confirm your payment</h1>
          <p className="text-clay text-sm mb-3">{message}</p>
          <p className="text-ink/60 mb-6">
            If you were charged, it will appear in your orders once it's confirmed.
          </p>
          <a href="/orders" className="underline">Check my orders</a>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-center">Loading…</p>}>
      <VerifyInner />
    </Suspense>
  );
}
