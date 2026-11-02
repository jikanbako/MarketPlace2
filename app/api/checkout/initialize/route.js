import { randomUUID } from 'crypto';
import { getAdmin, getUserFromRequest } from '@/lib/supabaseAdmin';
import { paystack } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

function fail(message, status = 400) {
  return Response.json({ error: message }, { status });
}

// Starts a payment. The browser only says WHAT it wants to buy
// (a product + quantity, or "my cart") and where to deliver it. Every
// price, total, and seller payout amount is recomputed here from the
// database — nothing money-related is taken from the request.
export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return fail('Please log in to check out', 401);
  if (!user.email) return fail('Your account needs an email address to pay');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid request');
  }

  const { source, product_id, quantity, delivery = {} } = body;

  const d = {
    name: clean(delivery.name, 100),
    phone: clean(delivery.phone, 30),
    address: clean(delivery.address, 300),
    city: clean(delivery.city, 100),
    state: clean(delivery.state, 100),
  };
  if (!d.name || !d.phone || !d.address || !d.city || !d.state) {
    return fail('Please fill in all the delivery details');
  }

  const admin = getAdmin();

  const { data: profile } = await admin
    .from('profiles')
    .select('banned')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.banned) return fail('Your account is restricted and cannot place orders', 403);

  // 1. What is being bought?
  let lines = [];
  if (source === 'cart') {
    const { data: cart } = await admin
      .from('cart_items')
      .select('product_id, quantity')
      .eq('user_id', user.id);
    lines = cart || [];
  } else if (source === 'buy_now') {
    const qty = parseInt(quantity, 10);
    if (!product_id || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      return fail('Invalid product or quantity');
    }
    lines = [{ product_id, quantity: qty }];
  } else {
    return fail('Invalid checkout type');
  }
  if (lines.length === 0) return fail('Your cart is empty');

  // 2. Load the real products, stores, and seller payout accounts
  const { data: products } = await admin
    .from('products')
    .select('id, title, price, stock_qty, store_id')
    .in('id', lines.map((l) => l.product_id));
  const productById = Object.fromEntries((products || []).map((p) => [p.id, p]));

  const storeIds = [...new Set((products || []).map((p) => p.store_id))];
  const { data: stores } = await admin
    .from('stores')
    .select('id, name, owner_id')
    .in('id', storeIds);
  const storeById = Object.fromEntries((stores || []).map((s) => [s.id, s]));

  const { data: payouts } = await admin
    .from('seller_payout_accounts')
    .select('store_id, paystack_subaccount_code')
    .in('store_id', storeIds);
  const payoutByStore = Object.fromEntries(
    (payouts || []).map((p) => [p.store_id, p.paystack_subaccount_code])
  );

  // 3. Validate every line and group them by store (one order per store)
  const groups = {};
  for (const line of lines) {
    const product = productById[line.product_id];
    if (!product) return fail('A product in your order is no longer available');

    const store = storeById[product.store_id];
    if (!store) return fail(`"${product.title}" is no longer available`);
    if (store.owner_id === user.id) return fail("You can't buy from your own store");
    if (!payoutByStore[store.id]) {
      return fail(`${store.name} isn't set up to receive payments yet`);
    }

    const inStock = product.stock_qty ?? 0;
    if (inStock < line.quantity) {
      return fail(
        inStock === 0
          ? `"${product.title}" is out of stock`
          : `Only ${inStock} of "${product.title}" left in stock`
      );
    }

    const unitKobo = Math.round(Number(product.price) * 100);
    if (!Number.isFinite(unitKobo) || unitKobo <= 0) {
      return fail(`"${product.title}" has an invalid price`);
    }

    if (!groups[store.id]) groups[store.id] = { store, items: [], subtotal: 0 };
    groups[store.id].items.push({
      product_id: product.id,
      title: product.title,
      unit_price_kobo: unitKobo,
      quantity: line.quantity,
    });
    groups[store.id].subtotal += unitKobo * line.quantity;
  }

  const groupList = Object.values(groups);
  const totalKobo = groupList.reduce((sum, g) => sum + g.subtotal, 0);
  const reference = `bl_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

  // 4. Record the pending payment + one pending order per store
  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({ reference, buyer_id: user.id, amount_kobo: totalKobo })
    .select()
    .single();
  if (paymentError) return fail('Could not start your payment. Please try again.', 500);

  // Deleting the payment cascades to its orders and order items
  const rollback = () => admin.from('payments').delete().eq('id', payment.id);

  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .insert(
      groupList.map((g) => ({
        payment_id: payment.id,
        buyer_id: user.id,
        store_id: g.store.id,
        subtotal_kobo: g.subtotal,
        delivery_name: d.name,
        delivery_phone: d.phone,
        delivery_address: d.address,
        delivery_city: d.city,
        delivery_state: d.state,
      }))
    )
    .select('id, store_id');
  if (ordersError) {
    await rollback();
    return fail('Could not create your order. Please try again.', 500);
  }

  const orderByStore = Object.fromEntries(orders.map((o) => [o.store_id, o.id]));
  const itemRows = groupList.flatMap((g) =>
    g.items.map((item) => ({ ...item, order_id: orderByStore[g.store.id] }))
  );
  const { error: itemsError } = await admin.from('order_items').insert(itemRows);
  if (itemsError) {
    await rollback();
    return fail('Could not create your order. Please try again.', 500);
  }

  // 5. Start the Paystack transaction, split straight to each seller.
  //    Flat shares add up to the full amount, so BuyLink's own share is
  //    zero. "all-proportional" makes Paystack's fee come out of each
  //    seller's share rather than BuyLink's.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const tx = await paystack('/transaction/initialize', {
      method: 'POST',
      body: {
        email: user.email,
        amount: totalKobo,
        currency: 'NGN',
        reference,
        callback_url: `${siteUrl}/checkout/verify`,
        metadata: { payment_id: payment.id, buyer_id: user.id },
        split: {
          type: 'flat',
          bearer_type: 'all-proportional',
          subaccounts: groupList.map((g) => ({
            subaccount: payoutByStore[g.store.id],
            share: g.subtotal,
          })),
        },
      },
    });

    return Response.json({ authorization_url: tx.authorization_url, reference });
  } catch (err) {
    await rollback();
    return fail(`Payment provider error: ${err.message}`, 502);
  }
}
