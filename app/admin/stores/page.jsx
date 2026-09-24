'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AdminStoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    setStores(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleVerified(store) {
    await supabase
      .from('stores')
      .update({ verified: !store.verified })
      .eq('id', store.id);
    load();
  }

  if (loading) return <p className="text-ink/60">Loading…</p>;

  return (
    <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
      {stores.map((s) => (
        <div key={s.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-ink/50">{s.category}{s.verified ? ' · verified' : ''}</p>
          </div>
          <button
            onClick={() => toggleVerified(s)}
            className={`text-xs px-3 py-1.5 rounded-md ${
              s.verified ? 'bg-ink/10 text-ink' : 'bg-moss text-sand'
            }`}
          >
            {s.verified ? 'Unverify' : 'Verify'}
          </button>
        </div>
      ))}
    </div>
  );
}
