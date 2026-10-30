'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function EditStorePage() {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [storeId, setStoreId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: store, error: loadError } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }
      if (!store) {
        setLoading(false);
        return;
      }

      setStoreId(store.id);
      setForm({
        name: store.name,
        category: store.category || '',
        description: store.description || '',
        phone_number: store.phone_number || '',
      });
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: updateError } = await supabase
      .from('stores')
      .update({
        name: form.name,
        category: form.category,
        description: form.description,
        phone_number: form.phone_number,
      })
      .eq('id', storeId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push('/dashboard');
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!form) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">No store to edit</h1>
        <a href="/dashboard" className="underline">Back to dashboard</a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-6">Edit store</h1>
      <form onSubmit={handleSave} className="space-y-4">
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
        <div>
          <label className="block text-sm mb-1">Phone number</label>
          <input
            type="tel"
            placeholder="e.g. +2348012345678"
            value={form.phone_number}
            onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
            className="w-full border border-ink/20 rounded-md px-3 py-2"
          />
          <p className="text-xs text-ink/50 mt-1">
            Shown on your posts so buyers can call or WhatsApp you directly. Leave blank to hide it.
          </p>
        </div>
        {error && <p className="text-clay text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
