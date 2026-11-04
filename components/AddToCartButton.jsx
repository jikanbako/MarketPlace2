'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// variant="icon"   → the round cart icon used in the feed's right-hand column
// variant="button" → a small outlined button for product cards
export default function AddToCartButton({ productId, stock = 1, variant = 'button' }) {
  const [state, setState] = useState('idle'); // idle | busy | added
  const [error, setError] = useState(null);

  async function handleAdd(e) {
    // These buttons sit inside cards that are links — don't follow the link
    e.preventDefault();
    e.stopPropagation();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }

    setState('busy');
    setError(null);

    const { data: existing } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle();

    const newQty = Math.min((existing?.quantity || 0) + 1, stock || 1, 99);

    const { error: saveError } = existing
      ? await supabase
          .from('cart_items')
          .update({ quantity: newQty })
          .eq('user_id', user.id)
          .eq('product_id', productId)
      : await supabase
          .from('cart_items')
          .insert({ user_id: user.id, product_id: productId, quantity: newQty });

    if (saveError) {
      setState('idle');
      setError(saveError.message);
      return;
    }

    setState('added');
    setTimeout(() => setState('idle'), 2500);
  }

  if (variant === 'icon') {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={handleAdd}
          disabled={state === 'busy'}
          className="flex flex-col items-center gap-1 disabled:opacity-50"
        >
          <span className="text-2xl">{state === 'added' ? '✅' : '🛒'}</span>
          <span className="text-xs">{state === 'added' ? 'Added' : 'Add'}</span>
        </button>
        {error && <span className="text-[10px] text-clay max-w-[70px] text-center">{error}</span>}
      </div>
    );
  }

  return (
    <div>
      {state === 'added' ? (
        <a
          href="/cart"
          className="block w-full text-center text-xs py-2 rounded-md bg-moss text-sand"
        >
          Added ✓ View cart
        </a>
      ) : (
        <button
          onClick={handleAdd}
          disabled={state === 'busy'}
          className="w-full text-xs py-2 rounded-md border border-ink/30 hover:border-ink disabled:opacity-50"
        >
          {state === 'busy' ? 'Adding…' : '🛒 Add to cart'}
        </button>
      )}
      {error && <p className="text-[11px] text-clay mt-1">{error}</p>}
    </div>
  );
}
