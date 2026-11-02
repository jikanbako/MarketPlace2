'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch } from '@/lib/apiFetch';

export default function PayoutsPage() {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [payout, setPayout] = useState(null);
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const { data: myStore } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();
      setStore(myStore);

      if (myStore) {
        const { data: existing } = await supabase
          .from('seller_payout_accounts')
          .select('*')
          .eq('store_id', myStore.id)
          .maybeSingle();
        setPayout(existing);

        try {
          const { banks: list } = await apiFetch('/api/payout/banks');
          setBanks(list);
        } catch (err) {
          setError(err.message);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const bank = banks.find((b) => b.code === bankCode);
      const result = await apiFetch('/api/payout/setup', {
        method: 'POST',
        body: JSON.stringify({
          bank_code: bankCode,
          bank_name: bank?.name,
          account_number: accountNumber,
        }),
      });

      setPayout({
        bank_name: result.bank_name,
        account_last4: result.account_last4,
        account_name: result.account_name,
      });
      setAccountNumber('');
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in first</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Create a store first</h1>
        <a href="/dashboard" className="underline">Go to dashboard</a>
      </div>
    );
  }

  const showForm = !payout || editing;

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-2">Payouts</h1>
      <p className="text-ink/60 text-sm mb-6">
        Add the bank account where your sales are paid. Customers pay
        through Paystack and your share goes straight to this account —
        BuyLink doesn't hold your money or take a commission. Paystack's
        processing fee is deducted from each payment.
      </p>

      {payout && !editing && (
        <div className="border border-ink/10 rounded-lg p-4 mb-4">
          <p className="text-xs text-moss font-medium mb-1">✓ Ready to receive payments</p>
          <p className="font-medium">{payout.bank_name || 'Bank account'}</p>
          <p className="text-sm text-ink/60">
            •••• {payout.account_last4}
            {payout.account_name ? ` · ${payout.account_name}` : ''}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-xs underline text-ink/60 mt-3"
          >
            Change account
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Bank</label>
            <select
              required
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="w-full border border-ink/20 rounded-md px-3 py-2 bg-sand"
            >
              <option value="">Select your bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Account number</label>
            <input
              type="text"
              inputMode="numeric"
              required
              maxLength={10}
              placeholder="10-digit NUBAN"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
          >
            {saving ? 'Verifying…' : payout ? 'Update account' : 'Save payout account'}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="w-full text-sm underline text-ink/60"
            >
              Cancel
            </button>
          )}
          <p className="text-xs text-ink/50">
            We only keep the last 4 digits of your account number; the full
            number is held by Paystack.
          </p>
        </form>
      )}

      {!showForm && error && <p className="text-clay text-sm mt-3">{error}</p>}
    </div>
  );
}
