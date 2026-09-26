'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', category: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const { data: existingStore } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();

      setStore(existingStore);
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreateStore(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { data, error: insertError } = await supabase
      .from('stores')
      .insert({
        owner_id: user.id,
        name: form.name,
        description: form.description,
        category: form.category,
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setStore(data);
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in to sell</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-16">
        <h1 className="font-display text-3xl mb-2">Set up your store</h1>
        <p className="text-ink/70 mb-6">
          This is your storefront — buyers will find your products under this name.
        </p>
        <form onSubmit={handleCreateStore} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Store name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Category</label>
            <input
              type="text"
              placeholder="e.g. Electronics, Fashion, Groceries"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create store'}
          </button>
        </form>
      </div>
    );
  }

  const VERIFICATION_BADGE = {
    none: { text: 'Not verified', color: 'text-ink/50' },
    pending: { text: 'Verification pending', color: 'text-ink/60' },
    approved: { text: 'Verified ✓', color: 'text-moss' },
    rejected: { text: 'Verification rejected', color: 'text-clay' },
  };
  const badge = VERIFICATION_BADGE[store.verification_status] || VERIFICATION_BADGE.none;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="font-display text-3xl">{store.name}</h1>
          <p className="text-ink/60 text-sm">{store.category}</p>
        </div>
        <a
          href="/dashboard/products/new"
          className="px-4 py-2 bg-ink text-sand rounded-md text-sm"
        >
          + Add product
        </a>
      </div>
      <a href="/dashboard/verify" className={`text-sm underline ${badge.color}`}>
        {badge.text}
      </a>
      <p className="text-ink/70 mt-4">{store.description}</p>
    </div>
  );
}
