'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function NewProductPage() {
  const router = useRouter();
  const [store, setStore] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    stock_qty: 1,
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: existingStore } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();
      setStore(existingStore);
    }
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: insertError } = await supabase.from('products').insert({
      store_id: store.id,
      title: form.title,
      description: form.description,
      price: parseFloat(form.price),
      category: form.category,
      stock_qty: parseInt(form.stock_qty, 10),
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push('/dashboard');
  }

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Create a store first</h1>
        <a href="/dashboard" className="underline">Go to dashboard</a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-6">Add a product</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Price (₦)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Stock</label>
            <input
              type="number"
              min="0"
              value={form.stock_qty}
              onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
              className="w-full border border-ink/20 rounded-md px-3 py-2"
            />
          </div>
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
        {error && <p className="text-clay text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add product'}
        </button>
      </form>
      <p className="text-xs text-ink/50 mt-4">
        Note: photo upload comes in Phase 2 (Discovery). This form saves the
        product without images for now — add photo_urls once Storage is wired up.
      </p>
    </div>
  );
}
