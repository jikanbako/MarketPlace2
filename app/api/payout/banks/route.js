import { getUserFromRequest } from '@/lib/supabaseAdmin';
import { paystack } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

// Nigerian banks from Paystack, for the payout-account dropdown.
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'Please log in' }, { status: 401 });

  try {
    const banks = await paystack('/bank?country=nigeria&perPage=200');
    const list = banks
      .filter((b) => b.active !== false && b.code)
      .map((b) => ({ name: b.name, code: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ banks: list });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
