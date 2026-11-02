'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { apiFetch } from '@/lib/apiFetch';

function CheckoutInner() {
  const params = useSearchParams();
  const source = params.get('source') === 'buy_now' ? 'buy_now' : 'cart';
  const productParam = params.get('product');
  const qtyParam = parseInt(params.get('qty') || '1', 10) || 1;

  const [user, setUser] = useState(null);
  const [lines, setLines] = useState([]); // { product, quantity }
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', city: '', state: '' });

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', currentUser.id)
        .single();
      setForm((f) => ({ ...f, name: profile?.full_name || '' }));

      const select = 'id, title, price, stock_qty, photo_urls, stores(name)';

      if (source === 'buy_now' && productParam) {
        const { data: product } = await supabase
          .from('products')
          .select(select)
          .eq('id', productParam)
          .maybeSingle();
        setLines(product ? [{ product, quantity: Math.min(Math.max(qtyParam, 1), 99) }] : []);
      } else {
        const { data: cart } = await supabase
          .from('cart_items')
          .select(`quantity, products(${select})`)
          .eq('user_id', currentUser.id);
        setLines(
          (cart || [])
            .filter((row) => row.products)
            .map((row) => ({ product: row.products, quantity: row.quantity }))
        );
      }
      setLoading(false);
    }
    load();
  }, [source, productParam, qtyParam]);

  async function handlePay(e) {
    e.preventDefault();
    setError(null);
    setPaying(true);

    try {
      const body =
        source === 'buy_now'
          ? { source, product_id: productParam, quantity: lines[0]?.quantity, delivery: form }
          : { source, delivery: form };

      const { authorization_url } = await apiFetch('/api/checkout/initialize', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      window.location.href = authorization_url;
    } catch (err) {
      setError(err.message);
      setPaying(false);
    }
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in to check out</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Nothing to check out</h1>
        <a href="/products" className="underline">Browse products</a>
      </div>
    );
  }

  const total = lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0);
  const field = (key, label, props = {}) => (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      <input
        required
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full border border-ink/20 rounded-md px-3 py-2"
        {...props}
      />
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-6">Checkout</h1>

      <div className="border border-ink/10 rounded-lg divide-y divide-ink/10 mb-6">
        {lines.map(({ product, quantity }) => (
          <div key={product.id} className="flex items-center gap-3 p-3">
            <div className="w-12 h-12 rounded-md bg-ink/5 overflow-hidden shrink-0">
              {product.photo_urls?.[0] && (
                <img src={product.photo_urls[0]} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{product.title}</p>
              <p className="text-xs text-ink/50">
                {product.stores?.name} · Qty {quantity}
              </p>
            </div>
            <p className="text-sm">₦{(Number(product.price) * quantity).toLocaleString()}</p>
          </div>
        ))}
        <div className="flex justify-between p-3 font-medium">
          <span>Total</span>
          <span>₦{total.toLocaleString()}</span>
        </div>
      </div>

      <form onSubmit={handlePay} className="space-y-4">
        <h2 className="font-display text-lg">Delivery details</h2>
        {field('name', 'Full name')}
        {field('phone', 'Phone number', { type: 'tel', placeholder: 'e.g. 08012345678' })}
        {field('address', 'Address')}
        <div className="grid grid-cols-2 gap-3">
          {field('city', 'City / town')}
          {field('state', 'State')}
        </div>

        {error && <p className="text-clay text-sm">{error}</p>}

        <button
          type="submit"
          disabled={paying}
          className="w-full bg-clay text-sand py-3 rounded-md disabled:opacity-50"
        >
          {paying ? 'Taking you to Paystack…' : `Pay ₦${total.toLocaleString()}`}
        </button>
        <p className="text-xs text-ink/50 text-center">
          You'll pay securely on Paystack. The final amount is confirmed on
          our server before you're charged. Delivery is arranged directly
          with the seller.
        </p>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-center">Loading…</p>}>
      <CheckoutInner />
    </Suspense>
  );
}
