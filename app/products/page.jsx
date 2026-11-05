'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import AddToCartButton from '@/components/AddToCartButton';
import { SearchIcon } from '@/components/Icons';

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function ProductSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-ink/10 animate-pulse">
      <div className="aspect-[4/5] bg-ink/10" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-ink/10 rounded w-3/4" />
        <div className="h-3 bg-ink/10 rounded w-1/2" />
        <div className="h-4 bg-ink/10 rounded w-1/3" />
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [viewerId, setViewerId] = useState(null);
  const debouncedQuery = useDebounced(query);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setViewerId(data?.user?.id || null));
  }, []);

  // Category chips. Product categories are free text, so "Fashion" and
  // "fashion" are folded together instead of showing up twice.
  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('products').select('category');
      const seen = new Map();
      (data || []).forEach((p) => {
        const label = (p.category || '').trim();
        if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
      });
      setCategories(Array.from(seen.values()).sort((a, b) => a.localeCompare(b)));
    }
    loadCategories();
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);

      let request = supabase
        .from('products')
        .select('*, stores(id, name, owner_id, payments_enabled, verified)')
        .order('created_at', { ascending: false });

      if (debouncedQuery.trim()) {
        // Postgres full-text search with prefix matching so partial
        // words still hit while the person is typing.
        const terms = debouncedQuery
          .trim()
          .split(/\s+/)
          .map((t) => `${t}:*`)
          .join(' & ');
        request = request.textSearch('fts', terms, { config: 'english' });
      }

      if (category !== 'all') {
        request = request.ilike('category', category);
      }

      const { data, error } = await request;

      // If the search syntax ever errors, show everything rather than a blank page
      if (error) {
        const { data: fallback } = await supabase
          .from('products')
          .select('*, stores(id, name, owner_id, payments_enabled, verified)')
          .order('created_at', { ascending: false });
        setProducts(fallback || []);
      } else {
        setProducts(data || []);
      }

      setLoading(false);
    }
    load();
  }, [debouncedQuery, category]);

  const chip = (value, label) => (
    <button
      key={value}
      onClick={() => setCategory(value)}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm border transition-colors ${
        category === value
          ? 'bg-ink text-sand border-ink'
          : 'bg-transparent text-ink/70 border-ink/20 hover:border-ink/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Search + categories stay put while you scroll the grid */}
      <div className="sticky top-0 z-10 bg-sand/95 backdrop-blur px-4 sm:px-6 pt-4 pb-3 border-b border-ink/5">
        <div className="relative">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="search"
            placeholder="Search products or stores"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-ink/15 bg-white/50 pl-11 pr-4 py-2.5 text-[15px] focus:outline-none focus:border-ink/40"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4 sm:mx-0 sm:px-0">
            {chip('all', 'All')}
            {categories.map((c) => chip(c, c))}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 py-5">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {Array.from({ length: 6 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-display text-xl mb-1">
              {query.trim() || category !== 'all' ? 'No matches' : 'No products yet'}
            </p>
            <p className="text-ink/60 text-sm mb-4">
              {query.trim() || category !== 'all'
                ? 'Try a different search or category.'
                : 'Be the first to list something.'}
            </p>
            {(query.trim() || category !== 'all') && (
              <button
                onClick={() => { setQuery(''); setCategory('all'); }}
                className="text-sm underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {products.map((product) => {
              const inStock = (product.stock_qty ?? 0) > 0;
              const canBuy =
                inStock &&
                product.stores?.payments_enabled &&
                product.stores?.owner_id !== viewerId;
              return (
                <div
                  key={product.id}
                  className="rounded-2xl overflow-hidden border border-ink/10 bg-white/30 flex flex-col"
                >
                  <a href={`/products/${product.id}`} className="block relative">
                    <div className="aspect-[4/5] bg-ink/5">
                      {product.photo_urls?.[0] ? (
                        <img
                          src={product.photo_urls[0]}
                          alt={product.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink/30 text-xs">
                          No image
                        </div>
                      )}
                    </div>
                    {!inStock && (
                      <span className="absolute top-2 left-2 text-[11px] font-medium bg-ink/80 text-sand px-2 py-0.5 rounded-full">
                        Sold out
                      </span>
                    )}
                  </a>

                  <div className="p-3 flex flex-col gap-0.5 flex-1">
                    <a href={`/products/${product.id}`} className="block">
                      <p className="text-[15px] font-medium leading-snug line-clamp-2">{product.title}</p>
                      <p className="text-xs text-ink/50 truncate">
                        {product.stores?.name}
                        {product.stores?.verified && <span className="text-moss"> ✓</span>}
                      </p>
                    </a>
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <p className="font-semibold text-clay">₦{Number(product.price).toLocaleString()}</p>
                      {canBuy && <AddToCartButton variant="compact" productId={product.id} stock={product.stock_qty} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
