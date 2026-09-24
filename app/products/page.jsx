'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['all']);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const debouncedQuery = useDebounced(query);

  // Load the full category list once, independent of search/filter state
  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('products').select('category');
      const set = new Set((data || []).map((p) => p.category).filter(Boolean));
      setCategories(['all', ...Array.from(set)]);
    }
    loadCategories();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);

      let request = supabase
        .from('products')
        .select('*, stores(id, name)')
        .order('created_at', { ascending: false });

      if (debouncedQuery.trim()) {
        // Postgres full-text search against title/category/description,
        // with prefix matching so partial words still hit while typing.
        const terms = debouncedQuery
          .trim()
          .split(/\s+/)
          .map((t) => `${t}:*`)
          .join(' & ');
        request = request.textSearch('fts', terms, { config: 'english' });
      }

      if (category !== 'all') {
        request = request.eq('category', category);
      }

      const { data, error } = await request;

      // Fallback: if the FTS query syntax errors for any reason, don't
      // leave the user with a blank screen — just show unfiltered results.
      if (error) {
        const { data: fallback } = await supabase
          .from('products')
          .select('*, stores(id, name)')
          .order('created_at', { ascending: false });
        setProducts(fallback || []);
      } else {
        setProducts(data || []);
      }

      setLoading(false);
    }
    load();
  }, [debouncedQuery, category]);

  if (loading && products.length === 0) {
    return <p className="px-6 py-16 text-center">Loading…</p>;
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

      {products.length === 0 ? (
        <p className="text-ink/60">
          {query.trim() ? 'No products match that search.' : 'No products yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => (
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
