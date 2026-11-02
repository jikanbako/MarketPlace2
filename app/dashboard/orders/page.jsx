'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const STATUS = {
  paid: { label: 'Paid — ship this order', color: 'text-clay' },
  shipped: { label: 'Shipped', color: 'text-ink/60' },
  delivered: { label: 'Delivered', color: 'text-moss' },
};

export default function SellerOrdersPage() {
  const [store, setStore] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function loadOrders(storeId) {
    const { data, error: loadError } = await supabase
      .from('orders')
      .select('*, order_items(id, title, unit_price_kobo, quantity)')
      .eq('store_id', storeId)
      .in('status', ['paid', 'shipped', 'delivered'])
      .order('created_at', { ascending: false });

    if (loadError) setError(loadError.message);
    else setOrders(data || []);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: myStore } = await supabase
        .from('stores')
        .select('id, name, payments_enabled')
        .eq('owner_id', user.id)
        .maybeSingle();
      setStore(myStore);
      if (myStore) await loadOrders(myStore.id);
      setLoading(false);
    }
    load();
  }, []);

  async function markShipped(orderId) {
    setBusyId(orderId);
    setError(null);
    const { error: rpcError } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_status: 'shipped',
    });
    if (rpcError) setError(rpcError.message);
    else await loadOrders(store.id);
    setBusyId(null);
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">You don't have a store yet</h1>
        <a href="/dashboard" className="underline">Go to dashboard</a>
      </div>
    );
  }

  const toShip = orders.filter((o) => o.status === 'paid').length;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-1">Orders</h1>
      <p className="text-sm text-ink/60 mb-6">
        {toShip > 0 ? `${toShip} waiting to be shipped` : 'Orders for your store appear here once they\'re paid.'}
      </p>

      {!store.payments_enabled && (
        <p className="text-sm border border-clay/40 bg-clay/5 rounded-md p-3 mb-4">
          You can't receive payments yet. <a href="/dashboard/payouts" className="underline">Add your bank account</a>
        </p>
      )}
      {error && <p className="text-clay text-sm mb-3">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-ink/60 text-center py-12">No paid orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const status = STATUS[o.status];
            return (
              <div key={o.id} className="border border-ink/10 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-xs text-ink/50">{new Date(o.created_at).toLocaleString()}</p>
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

                <div className="flex justify-between font-medium text-sm border-t border-ink/10 pt-2 mb-3">
                  <span>Order total</span>
                  <span>₦{(o.subtotal_kobo / 100).toLocaleString()}</span>
                </div>

                <div className="bg-ink/5 rounded-md p-3 text-sm">
                  <p className="font-medium">{o.delivery_name}</p>
                  <p className="text-ink/70">{o.delivery_address}</p>
                  <p className="text-ink/70">{o.delivery_city}, {o.delivery_state}</p>
                  <a href={`tel:${o.delivery_phone}`} className="underline text-ink/70">
                    📞 {o.delivery_phone}
                  </a>
                </div>

                {o.status === 'paid' && (
                  <button
                    onClick={() => markShipped(o.id)}
                    disabled={busyId === o.id}
                    className="w-full mt-3 bg-ink text-sand py-2 rounded-md text-sm disabled:opacity-50"
                  >
                    {busyId === o.id ? 'Saving…' : 'Mark as shipped'}
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
