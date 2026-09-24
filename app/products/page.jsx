'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select('*, stores(id, name)')
        .order('created_at', { ascending: false });
      setProducts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesQuery =
        query.trim() === '' ||
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.stores?.name?.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === 'all' || p.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [products, query, category]);

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (products.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">No products yet</h1>
        <p className="text-ink/60">Be the first to list something.</p>
        <a href="/dashboard" className="underline mt-4 inline-block">Start selling</a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-6">Browse products</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          placeholder="Search products or stores…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 border border-ink/20 rounded-md px-3 py-2"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-ink/20 rounded-md px-3 py-2 sm:w-48"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'all' ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-ink/60">No products match that search.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {filtered.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              className="border border-ink/10 rounded-lg p-4 hover:border-ink/30 transition-colors"
            >
              <p className="font-display text-lg">{product.title}</p>
              <p className="text-ink/60 text-sm mb-1">{product.stores?.name}</p>
              <p className="text-clay font-medium">
                ₦{Number(product.price).toLocaleString()}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
