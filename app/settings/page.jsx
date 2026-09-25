'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, location')
        .eq('id', currentUser.id)
        .single();

      setFullName(profile?.full_name || '');
      setLocation(profile?.location || '');
      setLoading(false);
    }
    load();
  }, []);

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileMessage(null);
    setProfileSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, location })
      .eq('id', user.id);

    setProfileSaving(false);
    setProfileMessage(error ? error.message : 'Saved.');
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters.');
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordMessage(error.message);
    } else {
      setPasswordMessage('Password updated.');
      setNewPassword('');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) return <p className="px-6 py-16 text-center">Loading…</p>;

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl mb-2">Log in to see settings</h1>
        <a href="/login" className="underline">Go to login</a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16 space-y-12">
      <div>
        <h1 className="font-display text-3xl mb-6">Settings</h1>

        <section className="mb-10">
          <h2 className="font-display text-lg mb-3">Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-ink/20 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Kaduna, Nigeria"
                className="w-full border border-ink/20 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full border border-ink/10 rounded-md px-3 py-2 bg-ink/5 text-ink/50"
              />
            </div>
            {profileMessage && (
              <p className={`text-sm ${profileMessage === 'Saved.' ? 'text-moss' : 'text-clay'}`}>
                {profileMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={profileSaving}
              className="bg-ink text-sand px-5 py-2 rounded-md text-sm disabled:opacity-50"
            >
              {profileSaving ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>

        <section className="mb-10">
          <h2 className="font-display text-lg mb-3">Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full border border-ink/20 rounded-md px-3 py-2"
              />
            </div>
            {passwordMessage && (
              <p className={`text-sm ${passwordMessage === 'Password updated.' ? 'text-moss' : 'text-clay'}`}>
                {passwordMessage}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordSaving}
              className="bg-ink text-sand px-5 py-2 rounded-md text-sm disabled:opacity-50"
            >
              {passwordSaving ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </section>

        <section>
          <button
            onClick={handleLogout}
            className="text-sm text-clay underline"
          >
            Log out
          </button>
        </section>
      </div>
    </div>
  );
}
