'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/products', label: 'Browse' },
  { href: '/dashboard', label: 'Sell' },
  { href: '/dashboard/posts/new', label: 'Post' },
  { href: '/messages', label: 'Messages' },
];

export default function NavBar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    <nav className="relative border-b border-ink/10">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <a href="/" className="font-display text-xl shrink-0">BuyLink</a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-5 text-sm">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-clay whitespace-nowrap">
              {l.label}
            </a>
          ))}
          {isAdmin && (
            <a href="/admin" className="hover:text-clay text-clay whitespace-nowrap">
              Admin
            </a>
          )}
          <a href="/login" className="hover:text-clay whitespace-nowrap">
            Log in
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
        >
          <span className="block w-6 h-0.5 bg-ink" />
          <span className="block w-6 h-0.5 bg-ink" />
          <span className="block w-6 h-0.5 bg-ink" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden flex flex-col border-t border-ink/10 bg-sand px-4 py-2">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="py-2.5 text-sm hover:text-clay"
            >
              {l.label}
            </a>
          ))}
          {isAdmin && (
            <a
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="py-2.5 text-sm text-clay"
            >
              Admin
            </a>
          )}
          <a
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="py-2.5 text-sm hover:text-clay"
          >
            Log in
          </a>
        </div>
      )}
    </nav>
  );
}
