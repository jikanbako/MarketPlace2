import { getAdmin, getUserFromRequest } from '@/lib/supabaseAdmin';
import { paystack } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

// Called when the buyer comes back from Paystack. We never trust the
// URL or the browser saying "it worked" — we ask Paystack directly,
// then mark the payment paid only if Paystack confirms it.
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'Please log in' }, { status: 401 });

  const reference = new URL(request.url).searchParams.get('reference');
  if (!reference) return Response.json({ error: 'Missing reference' }, { status: 400 });

  const admin = getAdmin();

  const { data: payment } = await admin
    .from('payments')
    .select('id, status')
    .eq('reference', reference)
    .eq('buyer_id', user.id)
    .maybeSingle();
  if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

  if (payment.status === 'paid') return Response.json({ status: 'paid' });

  let tx;
  try {
    tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }

  if (tx.status === 'success' && tx.currency === 'NGN') {
    const { error } = await admin.rpc('fulfill_payment', {
      p_reference: reference,
      p_amount_kobo: tx.amount,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ status: 'paid' });
  }

  if (tx.status === 'failed') {
    await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id).eq('status', 'pending');
    await admin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('payment_id', payment.id)
      .eq('status', 'pending_payment');
    return Response.json({ status: 'failed' });
  }

  // 'abandoned' or still processing
  return Response.json({ status: 'pending' });
}
