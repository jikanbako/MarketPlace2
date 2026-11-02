'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const STATUS = {
  paid: { label: 'Paid — waiting for seller to ship', color: 'text-ink/60' },
  shipped: { label: 'Shipped', color: 'text-clay' },
  delivered: { label: 'Delivered', color: 'text-moss' },
};

export default function OrdersPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function loadOrders(userId) {
    const { data, error: loadError } = await supabase
      .from('orders')
      .select('*, stores(id, name, phone_number), order_items(id, title, unit_price_kobo, quantity)')
      .eq('buyer_id', userId)
      .in('status', ['paid', 'shipped', 'delivered'])
      .order('created_at', { ascending: false });

    if (loadError) setError(loadError.message);
    else setOrders(data || []);
  }

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);
      await loadOrders(currentUser.id);
      setLoading(false);
    }
    load();
  }, []);

  async function markReceived(orderId) {
    setBusyId(orderId);
    setError(null);
    const { error: rpcError } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_status: 'delivered',
    });
    if (rpcError) setError(rpcError.message);
    else await loadOrders(user.id);
    setBusyId(null);
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in to see your orders</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-6">My orders</h1>
      {error && <p className="text-clay text-sm mb-3">{error}</p>}

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink/60 mb-3">You haven't bought anything yet.</p>
          <a href="/products" className="underline">Browse products</a>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const status = STATUS[o.status];
            return (
              <div key={o.id} className="border border-ink/10 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <a href={`/stores/${o.stores?.id}`} className="font-medium">
                      {o.stores?.name || 'Store'}
                    </a>
                    <p className="text-xs text-ink/50">
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className={`text-xs font-medium text-right ${status?.color}`}>{status?.label}</p>
                </div>

                <div className="space-y-1 mb-3">
                  {o.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="truncate pr-3">{item.title} × {item.quantity}</span>
                      <span className="shrink-0">
                        ₦{((item.unit_price_kobo * item.quantity) / 100).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-medium text-sm border-t border-ink/10 pt-2">
                  <span>Total</span>
                  <span>₦{(o.subtotal_kobo / 100).toLocaleString()}</span>
                </div>

                <p className="text-xs text-ink/50 mt-2">
                  Deliver to: {o.delivery_name}, {o.delivery_address}, {o.delivery_city}, {o.delivery_state}
                </p>

                {o.stores?.phone_number && o.status !== 'delivered' && (
                  <a href={`tel:${o.stores.phone_number}`} className="text-xs underline text-ink/60 mt-1 inline-block">
                    📞 Contact seller
                  </a>
                )}

                {o.status === 'shipped' && (
                  <button
                    onClick={() => markReceived(o.id)}
                    disabled={busyId === o.id}
                    className="w-full mt-3 bg-ink text-sand py-2 rounded-md text-sm disabled:opacity-50"
                  >
                    {busyId === o.id ? 'Saving…' : 'I received this order'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
