'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function StorePage() {
  const { id } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();
      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: false });
      setStore(storeData);
      setProducts(productData || []);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Store not found</h1>
        <a href="/products" className="underline">Back to browse</a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl mb-1">{store.name}</h1>
        {store.category && <p className="text-ink/60 text-sm mb-2">{store.category}</p>}
        {store.description && <p className="text-ink/70 max-w-xl">{store.description}</p>}
      </div>

      {products.length === 0 ? (
        <p className="text-ink/60">This store hasn't listed any products yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <a
              key={product.id}
              href={`/products/${product.id}`}
              className="border border-ink/10 rounded-lg p-4 hover:border-ink/30 transition-colors"
            >
              <p className="font-display text-lg">{product.title}</p>
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
