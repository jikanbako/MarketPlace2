'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const STATUS_LABEL = {
  none: null,
  pending: { text: 'Submitted — under review', color: 'text-ink/60' },
  approved: { text: 'Verified', color: 'text-moss' },
  rejected: { text: 'Rejected', color: 'text-clay' },
};

export default function VerifyPage() {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const { data: existingStore } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', currentUser.id)
        .maybeSingle();
      setStore(existingStore);
      setLoading(false);
    }
    load();
  }, []);

  async function uploadDoc(file, label) {
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${store.id}/${label}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('verification-docs')
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    return path;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!idFile || !proofFile) {
      setError('Both documents are required.');
      return;
    }

    setSaving(true);
    try {
      const idPath = await uploadDoc(idFile, 'id-document');
      const proofPath = await uploadDoc(proofFile, 'business-proof');

      const { error: updateError } = await supabase
        .from('stores')
        .update({
          id_document_url: idPath,
          business_proof_url: proofPath,
          verification_status: 'pending',
          verification_submitted_at: new Date().toISOString(),
          verification_note: null,
        })
        .eq('id', store.id);

      if (updateError) throw updateError;

      setStore((s) => ({ ...s, verification_status: 'pending' }));
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in first</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Create a store first</h1>
        <a href="/dashboard" className="underline">Go to dashboard</a>
      </div>
    );
  }

  const status = STATUS_LABEL[store.verification_status] ?? null;

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl mb-2">Get verified</h1>
      <p className="text-ink/60 text-sm mb-6">
        A verified badge helps buyers trust your store. Submit a government ID
        and proof of business (a CAC certificate, a utility bill in your
        business name, or similar) for review.
      </p>

      {status && (
        <p className={`text-sm font-medium mb-4 ${status.color}`}>{status.text}</p>
      )}

      {store.verification_status === 'rejected' && store.verification_note && (
        <div className="bg-clay/10 border border-clay/30 rounded-md p-3 mb-4 text-sm">
          <p className="font-medium text-clay mb-1">Reason for rejection:</p>
          <p className="text-ink/80">{store.verification_note}</p>
        </div>
      )}

      {store.verification_status === 'approved' ? (
        <p className="text-sm text-ink/60">
          Your store is verified. No further action needed.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Government ID</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setIdFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Proof of business</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-ink text-sand py-2.5 rounded-md disabled:opacity-50"
          >
            {saving
              ? 'Submitting…'
              : store.verification_status === 'rejected'
              ? 'Resubmit'
              : 'Submit for review'}
          </button>
          <p className="text-xs text-ink/50">
            Only you and admins can ever view these documents.
          </p>
        </form>
      )}
    </div>
  );
}
