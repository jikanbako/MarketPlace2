'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function CartPage() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadCart(userId) {
    const { data, error: loadError } = await supabase
      .from('cart_items')
      .select('quantity, product_id, products(id, title, price, stock_qty, photo_urls, stores(name, payments_enabled))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
      return;
    }
    // A product deleted since being added leaves a row with no product
    setItems((data || []).filter((row) => row.products));
  }

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);
      await loadCart(currentUser.id);
      setLoading(false);
    }
    load();
  }, []);

  async function changeQuantity(productId, newQty) {
    if (newQty < 1) return;
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ quantity: newQty })
      .eq('user_id', user.id)
      .eq('product_id', productId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((rows) =>
      rows.map((r) => (r.product_id === productId ? { ...r, quantity: newQty } : r))
    );
  }

  async function removeItem(productId) {
    await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', productId);
    setItems((rows) => rows.filter((r) => r.product_id !== productId));
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in to see your cart</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Your cart is empty</h1>
        <p className="text-ink/60 mb-4">Find something you like and add it here.</p>
        <a href="/products" className="underline">Browse products</a>
      </div>
    );
  }

  const unavailable = (row) =>
    row.products.stock_qty <= 0 || !row.products.stores?.payments_enabled;
  const total = items
    .filter((r) => !unavailable(r))
    .reduce((sum, r) => sum + Number(r.products.price) * r.quantity, 0);
  const canCheckout = items.some((r) => !unavailable(r));

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-6">Your cart</h1>

      <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden mb-6">
        {items.map((row) => {
          const p = row.products;
          const blocked = unavailable(row);
          return (
            <div key={row.product_id} className="flex gap-3 p-4">
              <a href={`/products/${p.id}`} className="w-20 h-20 shrink-0 rounded-md bg-ink/5 overflow-hidden">
                {p.photo_urls?.[0] && (
                  <img src={p.photo_urls[0]} alt="" className="w-full h-full object-cover" />
                )}
              </a>
              <div className="flex-1 min-w-0">
                <a href={`/products/${p.id}`} className="font-medium text-sm block truncate">
                  {p.title}
                </a>
                <p className="text-xs text-ink/50">{p.stores?.name}</p>
                <p className="text-clay font-medium text-sm mt-1">
                  ₦{Number(p.price).toLocaleString()}
                </p>

                {blocked ? (
                  <p className="text-xs text-clay mt-1">
                    {p.stock_qty <= 0 ? 'Out of stock' : "Seller can't accept payments yet"}
                  </p>
                ) : (
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border border-ink/20 rounded-md text-sm">
                      <button
                        onClick={() => changeQuantity(row.product_id, row.quantity - 1)}
                        className="px-2.5 py-1"
                      >
                        −
                      </button>
                      <span className="px-2 min-w-[1.5rem] text-center">{row.quantity}</span>
                      <button
                        onClick={() =>
                          changeQuantity(row.product_id, Math.min(row.quantity + 1, p.stock_qty, 99))
                        }
                        className="px-2.5 py-1"
                      >
                        +
                      </button>
                    </div>
                    {row.quantity > p.stock_qty && (
                      <span className="text-xs text-clay">Only {p.stock_qty} left</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeItem(row.product_id)}
                className="text-xs text-ink/50 underline self-start"
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="text-clay text-sm mb-3">{error}</p>}

      <div className="flex items-center justify-between mb-4">
        <span className="text-ink/60">Total</span>
        <span className="font-display text-2xl">₦{total.toLocaleString()}</span>
      </div>

      <a
        href={canCheckout ? '/checkout?source=cart' : undefined}
        aria-disabled={!canCheckout}
        className={`block text-center w-full py-3 rounded-md ${
          canCheckout ? 'bg-clay text-sand' : 'bg-ink/20 text-ink/40 pointer-events-none'
        }`}
      >
        Checkout
      </a>
      <p className="text-xs text-ink/50 mt-3 text-center">
        Items from different sellers are paid in one go — each seller receives their share directly.
      </p>
    </div>
  );
}
