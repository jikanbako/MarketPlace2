'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function MessagesInboxPage() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const { data } = await supabase
        .from('conversations')
        .select('*, products(title), buyer:buyer_id(full_name), seller:seller_id(full_name)')
        .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
        .order('last_message_at', { ascending: false });

      setConversations(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in to see messages</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">No conversations yet</h1>
        <p className="text-ink/60">
          Message a seller from a product page to start one.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-6">Messages</h1>
      <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
        {conversations.map((c) => {
          const otherParty = c.buyer_id === user.id ? c.seller : c.buyer;
          return (
            <a
              key={c.id}
              href={`/messages/${c.id}`}
              className="block px-4 py-3 hover:bg-ink/5"
            >
              <p className="font-medium">{otherParty?.full_name || 'User'}</p>
              <p className="text-sm text-ink/60">
                {c.products?.title || 'General inquiry'}
              </p>
            </a>
          );
        })}
      </div>
    </div>
  );
}
