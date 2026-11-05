'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// How many distinct items are in the signed-in user's cart (0 if signed out).
// Re-checks whenever anything dispatches a "cart-updated" event — the
// Add to cart button does this so the badge updates the moment you tap it.
export default function useCartCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCount(0);
      return;
    }
    const { count: total } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setCount(total || 0);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('cart-updated', refresh);
    const { data: listener } = supabase.auth.onAuthStateChange(() => refresh());
    return () => {
      window.removeEventListener('cart-updated', refresh);
      listener.subscription.unsubscribe();
    };
  }, [refresh]);

  return count;
}
