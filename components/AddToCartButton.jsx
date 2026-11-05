'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BagIcon, CheckIcon } from '@/components/Icons';

// variant="icon"    → bag icon + label, for the feed's right-hand column
// variant="compact" → small round button, for product cards
// variant="button"  → full-width outlined button
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
    window.dispatchEvent(new Event('cart-updated')); // refreshes the cart badge
    setTimeout(() => setState('idle'), 2200);
  }

  if (variant === 'icon') {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={handleAdd}
          disabled={state === 'busy'}
          aria-label="Add to cart"
          className="flex flex-col items-center gap-1 disabled:opacity-50 active:scale-90 transition-transform"
        >
          <span
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm ${
              state === 'added' ? 'bg-moss text-white' : 'bg-black/30 text-white'
            }`}
          >
            {state === 'added' ? <CheckIcon size={22} /> : <BagIcon size={22} />}
          </span>
          <span className="text-[11px] font-medium drop-shadow">
            {state === 'added' ? 'Added' : 'Cart'}
          </span>
        </button>
        {error && <span className="text-[10px] text-red-300 max-w-[70px] text-center">{error}</span>}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          onClick={handleAdd}
          disabled={state === 'busy'}
          aria-label="Add to cart"
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-50 ${
            state === 'added' ? 'bg-moss text-sand' : 'bg-ink text-sand'
          }`}
        >
          {state === 'added' ? <CheckIcon size={18} /> : <BagIcon size={18} />}
        </button>
        {error && (
          <p className="absolute right-0 top-full mt-1 w-40 text-[11px] text-clay bg-sand border border-clay/30 rounded-md p-1.5 z-10">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {state === 'added' ? (
        <a href="/cart" className="block w-full text-center text-xs py-2 rounded-md bg-moss text-sand">
          Added ✓ View cart
        </a>
      ) : (
        <button
          onClick={handleAdd}
          disabled={state === 'busy'}
          className="w-full text-xs py-2 rounded-md border border-ink/30 hover:border-ink disabled:opacity-50"
        >
          {state === 'busy' ? 'Adding…' : 'Add to cart'}
        </button>
      )}
      {error && <p className="text-[11px] text-clay mt-1">{error}</p>}
    </div>
  );
}
