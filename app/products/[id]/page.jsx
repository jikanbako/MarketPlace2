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
  const [activePhoto, setActivePhoto] = useState(0);
  const [qty, setQty] = useState(1);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartMessage, setCartMessage] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data } = await supabase
        .from('products')
        .select('*, stores(id, name, description, owner_id, payments_enabled)')
        .eq('id', id)
        .single();
      setProduct(data);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleAddToCart() {
    if (!user) {
      router.push('/login');
      return;
    }
    setCartBusy(true);
    setCartMessage(null);

    const { data: existing } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', user.id)
      .eq('product_id', product.id)
      .maybeSingle();

    const newQty = Math.min((existing?.quantity || 0) + qty, product.stock_qty || 1, 99);

    const { error } = existing
      ? await supabase
          .from('cart_items')
          .update({ quantity: newQty })
          .eq('user_id', user.id)
          .eq('product_id', product.id)
      : await supabase
          .from('cart_items')
          .insert({ user_id: user.id, product_id: product.id, quantity: newQty });

    setCartBusy(false);
    setCartMessage(error ? { error: error.message } : { ok: true });
  }

  function handleBuyNow() {
    if (!user) {
      router.push('/login');
      return;
    }
    router.push(`/checkout?source=buy_now&product=${product.id}&qty=${qty}`);
  }

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

  const isOwner = user && product.stores?.owner_id === user.id;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <a href="/products" className="text-sm text-ink/60 hover:text-clay">
        ← Back to browse
      </a>

      {product.photo_urls?.length > 0 ? (
        <div className="mt-4">
          <div className="aspect-square bg-ink/5 rounded-lg overflow-hidden">
            <img
              src={product.photo_urls[activePhoto]}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>
          {product.photo_urls.length > 1 && (
            <div className="flex gap-2 mt-2">
              {product.photo_urls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`w-14 h-14 rounded-md overflow-hidden border-2 ${
                    i === activePhoto ? 'border-clay' : 'border-transparent'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 aspect-square bg-ink/5 rounded-lg flex items-center justify-center text-ink/30 text-sm">
          No photos yet
        </div>
      )}

      <h1 className="font-display text-3xl mt-6 mb-2">{product.title}</h1>
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
      <p className="text-sm text-ink/50 mb-4">
        {product.stock_qty > 0 ? `${product.stock_qty} in stock` : 'Out of stock'}
      </p>

      {isOwner ? (
        <p className="text-sm text-ink/50 mb-4">This is your product.</p>
      ) : !product.stores?.payments_enabled ? (
        <p className="text-sm text-ink/60 border border-ink/10 rounded-md p-3 mb-4">
          This seller hasn't set up payments yet. You can still message them
          to arrange a purchase.
        </p>
      ) : product.stock_qty > 0 ? (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm">Quantity</span>
            <div className="flex items-center border border-ink/20 rounded-md">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-1.5"
              >
                −
              </button>
              <span className="px-3 text-sm min-w-[2rem] text-center">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(product.stock_qty, 99, q + 1))}
                className="px-3 py-1.5"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleBuyNow}
              className="flex-1 px-6 py-3 bg-clay text-sand rounded-md"
            >
              Buy now · ₦{(Number(product.price) * qty).toLocaleString()}
            </button>
            <button
              onClick={handleAddToCart}
              disabled={cartBusy}
              className="flex-1 px-6 py-3 border border-ink rounded-md disabled:opacity-50"
            >
              {cartBusy ? 'Adding…' : 'Add to cart'}
            </button>
          </div>
          {cartMessage?.ok && (
            <p className="text-sm text-moss mt-2">
              Added to your cart. <a href="/cart" className="underline">View cart</a>
            </p>
          )}
          {cartMessage?.error && <p className="text-sm text-clay mt-2">{cartMessage.error}</p>}
        </div>
      ) : null}

      <button
        onClick={handleMessageSeller}
        disabled={starting || isOwner}
        className="px-6 py-3 bg-ink text-sand rounded-md disabled:opacity-50"
      >
        {starting ? 'Starting…' : 'Message seller'}
      </button>
    </div>
  );
}
