import crypto from 'crypto';
import { getAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Paystack calls this directly when a payment succeeds — so an order
// still gets marked paid even if the buyer closes their browser before
// returning to the site. Every request is checked against Paystack's
// signature first; anything unsigned or tampered with is rejected.
export async function POST(request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return Response.json({ error: 'Not configured' }, { status: 500 });

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature') || '';

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (event.event === 'charge.success') {
    const { reference, amount, currency } = event.data || {};
    const admin = getAdmin();

    const { data: payment } = await admin
      .from('payments')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    // A reference we don't know isn't ours (e.g. another product on the
    // same Paystack account) — acknowledge it and move on.
    if (payment && currency === 'NGN') {
      const { error } = await admin.rpc('fulfill_payment', {
        p_reference: reference,
        p_amount_kobo: amount,
      });

      if (error) {
        console.error('fulfill_payment failed:', error.message);
        // An amount mismatch will never fix itself on retry; anything
        // else might, so ask Paystack to try again.
        if (!error.message.includes('Amount mismatch')) {
          return Response.json({ error: 'Temporary failure' }, { status: 500 });
        }
      }
    }
  }

  return Response.json({ received: true });
}
