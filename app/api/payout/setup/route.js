import { getAdmin, getUserFromRequest } from '@/lib/supabaseAdmin';
import { paystack, isTestMode } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

// Creates (or updates) the seller's Paystack subaccount — the account
// their share of every sale is paid into, directly, with BuyLink taking
// nothing (percentage_charge: 0).
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'Please log in' }, { status: 401 });

  const { bank_code, bank_name, account_number } = await request.json();
  const accountNumber = String(account_number || '').replace(/\s/g, '');

  if (!bank_code || !/^\d{10}$/.test(accountNumber)) {
    return Response.json(
      { error: 'Choose a bank and enter a 10-digit account number' },
      { status: 400 }
    );
  }

  const admin = getAdmin();

  const { data: store } = await admin
    .from('stores')
    .select('id, name, owner_id')
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!store) {
    return Response.json({ error: 'Create your store first' }, { status: 400 });
  }

  // Look up the name on the account so the seller can see it's really
  // theirs. Paystack's test mode can't resolve arbitrary test numbers,
  // so a failed lookup only blocks setup in live mode.
  let accountName = null;
  try {
    const resolved = await paystack(
      `/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bank_code)}`
    );
    accountName = resolved.account_name;
  } catch (err) {
    if (!isTestMode()) {
      return Response.json(
        { error: `Couldn't verify that account: ${err.message}` },
        { status: 400 }
      );
    }
  }

  try {
    const { data: existing } = await admin
      .from('seller_payout_accounts')
      .select('paystack_subaccount_code')
      .eq('store_id', store.id)
      .maybeSingle();

    let subaccountCode;

    if (existing) {
      await paystack(`/subaccount/${existing.paystack_subaccount_code}`, {
        method: 'PUT',
        body: {
          business_name: store.name,
          settlement_bank: bank_code,
          account_number: accountNumber,
          percentage_charge: 0,
        },
      });
      subaccountCode = existing.paystack_subaccount_code;
    } else {
      const created = await paystack('/subaccount', {
        method: 'POST',
        body: {
          business_name: store.name,
          settlement_bank: bank_code,
          account_number: accountNumber,
          percentage_charge: 0,
          primary_contact_email: user.email,
          description: `BuyLink store ${store.id}`,
        },
      });
      subaccountCode = created.subaccount_code;
    }

    const { error: saveError } = await admin.from('seller_payout_accounts').upsert({
      store_id: store.id,
      owner_id: user.id,
      bank_code,
      bank_name: bank_name || null,
      account_last4: accountNumber.slice(-4),
      account_name: accountName,
      paystack_subaccount_code: subaccountCode,
    });
    if (saveError) throw new Error(saveError.message);

    await admin.from('stores').update({ payments_enabled: true }).eq('id', store.id);

    return Response.json({
      ok: true,
      account_name: accountName,
      bank_name: bank_name || null,
      account_last4: accountNumber.slice(-4),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
