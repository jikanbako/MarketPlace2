'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ProductDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data } = await supabase
        .from('products')
        .select('*, stores(id, name, description, owner_id)')
        .eq('id', id)
        .single();
      setProduct(data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleMessageSeller() {
    if (!user) {
      router.push('/login');
      return;
    }
    const sellerId = product.stores?.owner_id;
    if (!sellerId || sellerId === user.id) return;

    setStarting(true);

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('seller_id', sellerId)
      .eq('product_id', product.id)
      .maybeSingle();

    if (existing) {
      router.push(`/messages/${existing.id}`);
      return;
    }

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ buyer_id: user.id, seller_id: sellerId, product_id: product.id })
      .select()
      .single();

    setStarting(false);

    if (!error && created) {
      router.push(`/messages/${created.id}`);
    }
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!product) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Product not found</h1>
        <a href="/products" className="underline">Back to browse</a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <a href="/products" className="text-sm text-ink/60 hover:text-clay">
        ← Back to browse
      </a>
      <h1 className="font-display text-3xl mt-4 mb-2">{product.title}</h1>
      <a
        href={`/stores/${product.stores?.id}`}
        className="text-ink/60 hover:text-clay text-sm"
      >
        Sold by {product.stores?.name}
      </a>
      <p className="text-clay text-2xl font-medium mt-4 mb-6">
        ₦{Number(product.price).toLocaleString()}
      </p>
      <p className="text-ink/80 mb-6">{product.description}</p>
      <p className="text-sm text-ink/50 mb-8">
        {product.stock_qty > 0 ? `${product.stock_qty} in stock` : 'Out of stock'}
      </p>
      <button
        onClick={handleMessageSeller}
        disabled={starting || product.stores?.owner_id === user?.id}
        className="px-6 py-3 bg-ink text-sand rounded-md disabled:opacity-50"
      >
        {starting ? 'Starting…' : 'Message seller'}
      </button>
    </div>
  );
}
