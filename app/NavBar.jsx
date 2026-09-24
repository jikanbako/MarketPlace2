'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function NavBar() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
    }
    checkRole();
  }, []);

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-ink/10">
      <a href="/" className="font-display text-xl">BuyLink</a>
      <div className="flex gap-5 text-sm">
        <a href="/feed" className="hover:text-clay">Feed</a>
        <a href="/products" className="hover:text-clay">Browse</a>
        <a href="/dashboard" className="hover:text-clay">Sell</a>
        <a href="/dashboard/posts/new" className="hover:text-clay">Post</a>
        <a href="/messages" className="hover:text-clay">Messages</a>
        {isAdmin && <a href="/admin" className="hover:text-clay text-clay">Admin</a>}
        <a href="/login" className="hover:text-clay">Log in</a>
      </div>
    </nav>
  );
}
