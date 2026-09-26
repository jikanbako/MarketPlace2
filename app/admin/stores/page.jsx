'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function DocLink({ path, label }) {
  const [url, setUrl] = useState(null);

  async function reveal() {
    const { data } = await supabase.storage
      .from('verification-docs')
      .createSignedUrl(path, 60 * 5); // 5 minute link
    if (data) setUrl(data.signedUrl);
  }

  if (!path) return <span className="text-ink/40">Not submitted</span>;

  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="underline text-ink">
      Open {label}
    </a>
  ) : (
    <button onClick={reveal} className="underline text-ink/70">
      View {label}
    </button>
  );
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteDrafts, setNoteDrafts] = useState({});

  async function load() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });
    setStores(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(store) {
    await supabase
      .from('stores')
      .update({ verification_status: 'approved', verified: true, verification_note: null })
      .eq('id', store.id);
    load();
  }

  async function reject(store) {
    const note = noteDrafts[store.id]?.trim();
    if (!note) {
      alert('Add a reason before rejecting.');
      return;
    }
    await supabase
      .from('stores')
      .update({ verification_status: 'rejected', verified: false, verification_note: note })
      .eq('id', store.id);
    load();
  }

  async function toggleVerified(store) {
    await supabase
      .from('stores')
      .update({ verified: !store.verified })
      .eq('id', store.id);
    load();
  }

  if (loading) return <p className="text-ink/60">Loading…</p>;

  const pending = stores.filter((s) => s.verification_status === 'pending');
  const others = stores.filter((s) => s.verification_status !== 'pending');

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-lg mb-3">
          Pending verification {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="text-ink/50 text-sm">Nothing waiting for review.</p>
        ) : (
          <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
            {pending.map((s) => (
              <div key={s.id} className="px-4 py-4">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-ink/50 mb-2">{s.category}</p>
                <div className="flex gap-4 text-xs mb-3">
                  <DocLink path={s.id_document_url} label="ID" />
                  <DocLink path={s.business_proof_url} label="business proof" />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => approve(s)}
                    className="text-xs px-3 py-1.5 bg-moss text-sand rounded-md"
                  >
                    Approve
                  </button>
                  <input
                    type="text"
                    placeholder="Reason for rejecting (required to reject)"
                    value={noteDrafts[s.id] || ''}
                    onChange={(e) =>
                      setNoteDrafts((d) => ({ ...d, [s.id]: e.target.value }))
                    }
                    className="flex-1 border border-ink/20 rounded-md px-2 py-1 text-xs"
                  />
                  <button
                    onClick={() => reject(s)}
                    className="text-xs px-3 py-1.5 bg-clay text-sand rounded-md"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">All stores</h2>
        <div className="divide-y divide-ink/10 border border-ink/10 rounded-lg overflow-hidden">
          {others.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-ink/50">
                  {s.category} · {s.verification_status}
                  {s.verified ? ' · verified' : ''}
                </p>
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
      </section>
    </div>
  );
}
