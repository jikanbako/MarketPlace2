'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminHome() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    async function load() {
      const [users, stores, unverifiedStores, posts, banned] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('stores').select('*', { count: 'exact', head: true }),
        supabase.from('stores').select('*', { count: 'exact', head: true }).eq('verified', false),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('banned', true),
      ]);
      setCounts({
        users: users.count ?? 0,
        stores: stores.count ?? 0,
        unverifiedStores: unverifiedStores.count ?? 0,
        posts: posts.count ?? 0,
        banned: banned.count ?? 0,
      });
    }
    load();
  }, []);

  if (!counts) return <p className="text-ink/60">Loading…</p>;

  const cards = [
    { label: 'Total users', value: counts.users, href: '/admin/users' },
    { label: 'Banned users', value: counts.banned, href: '/admin/users' },
    { label: 'Stores', value: counts.stores, href: '/admin/stores' },
    { label: 'Stores awaiting verification', value: counts.unverifiedStores, href: '/admin/stores' },
    { label: 'Posts on the feed', value: counts.posts, href: '/admin/posts' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <a
          key={c.label}
          href={c.href}
          className="border border-ink/10 rounded-lg p-4 hover:border-ink/30 transition-colors"
        >
          <p className="text-3xl font-display">{c.value}</p>
          <p className="text-sm text-ink/60">{c.label}</p>
        </a>
      ))}
    </div>
  );
}
