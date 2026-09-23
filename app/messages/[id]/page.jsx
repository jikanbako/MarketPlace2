'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function ConversationPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`conversation-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: user.id,
      text: text.trim(),
    });

    if (!error) {
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', id);
      setText('');
    }
    setSending(false);
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col h-[calc(100vh-80px)]">
      <a href="/messages" className="text-sm text-ink/60 hover:text-clay mb-4">
        ← Inbox
      </a>
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <p className="text-ink/50 text-sm text-center mt-8">
            Say hello to start the conversation.
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === user?.id;
          return (
            <div
              key={m.id}
              className={`max-w-[75%] px-4 py-2 rounded-lg ${
                isMine ? 'bg-ink text-sand ml-auto' : 'bg-ink/5'
              }`}
            >
              {m.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 border border-ink/20 rounded-md px-3 py-2"
        />
        <button
          type="submit"
          disabled={sending}
          className="px-5 py-2 bg-ink text-sand rounded-md disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
