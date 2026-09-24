'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminLayout({ children }) {
  const [status, setStatus] = useState('loading'); // loading | allowed | denied

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('denied');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setStatus(profile?.role === 'admin' ? 'allowed' : 'denied');
    }
    check();
  }, []);

  if (status === 'loading') return <p className="px-6 py-16 text-center">Loading…</p>;

  if (status === 'denied') {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Admins only</h1>
        <p className="text-ink/60">You don't have access to this area.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl mb-6">Admin</h1>
      <div className="flex gap-5 text-sm border-b border-ink/10 mb-8">
        <a href="/admin" className="pb-3 hover:text-clay">Overview</a>
        <a href="/admin/users" className="pb-3 hover:text-clay">Users</a>
        <a href="/admin/stores" className="pb-3 hover:text-clay">Stores</a>
        <a href="/admin/posts" className="pb-3 hover:text-clay">Posts</a>
      </div>
      {children}
    </div>
  );
}
