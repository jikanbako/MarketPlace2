'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function EditProductPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      setForm({
        title: data.title,
        description: data.description || '',
        price: data.price,
        category: data.category || '',
        stock_qty: data.stock_qty,
      });
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const { error: updateError } = await supabase
      .from('products')
      .update({
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        category: form.category,
        stock_qty: parseInt(form.stock_qty, 10),
      })
      .eq('id', id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push('/dashboard');
  }

  async function handleDelete() {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    await supabase.from('products').delete().eq('id', id);
    router.push('/dashboard');
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (error && !form) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <p className="text-clay mb-2">{error}</p>
        <a href="/dashboard" className="underline">Back to dashboard</a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-6">Edit product</h1>
      <form onSubmit={handleSave} className="space-y-4">
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
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-full text-clay text-sm underline py-1"
        >
          Delete this product
        </button>
      </form>
    </div>
  );
}
