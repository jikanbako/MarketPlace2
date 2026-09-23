'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleBan(user) {
    await supabase
      .from('profiles')
      .update({ banned: !user.banned })
      .eq('id', user.id);
    load();
  }

  if (loading) return <p className="text-ink/60">Loading…</p>;

  return (
    <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
      {users.map((u) => (
        <div key={u.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="font-medium">{u.full_name || 'Unnamed'}</p>
            <p className="text-xs text-ink/50">{u.role}{u.banned ? ' · banned' : ''}</p>
          </div>
          {u.role !== 'admin' && (
            <button
              onClick={() => toggleBan(u)}
              className={`text-xs px-3 py-1.5 rounded-md ${
                u.banned ? 'bg-moss text-sand' : 'bg-clay text-sand'
              }`}
            >
              {u.banned ? 'Unban' : 'Ban'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
