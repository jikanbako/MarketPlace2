'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { BagIcon } from '@/components/Icons';
import useCartCount from '@/components/useCartCount';

const LINKS = [
  { href: '/feed', label: 'Feed' },
  { href: '/products', label: 'Browse' },
  { href: '/dashboard', label: 'Sell' },
  { href: '/dashboard/posts/new', label: 'Post' },
  { href: '/messages', label: 'Messages' },
  { href: '/orders', label: 'Orders' },
];

export default function NavBar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cartCount = useCartCount();

  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setLoggedIn(true);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');
    }
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
      if (!session?.user) setIsAdmin(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Close the mobile menu whenever you navigate somewhere
  useEffect(() => setMenuOpen(false), [pathname]);

  const accountLink = loggedIn
    ? { href: '/settings', label: 'Settings' }
    : { href: '/login', label: 'Log in' };

  // The feed is full-screen on phones and draws its own header, so this
  // bar steps aside there (it still shows on desktop).
  const hiddenOnMobile = pathname === '/feed' ? 'hidden md:block' : '';

  const linkClass = (href) =>
    `whitespace-nowrap transition-colors ${
      pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
        ? 'text-clay font-medium'
        : 'text-ink/70 hover:text-clay'
    }`;

  const cartButton = (
    <a href="/cart" aria-label="Cart" className="relative p-2 text-ink">
      <BagIcon size={22} />
      {cartCount > 0 && (
        <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-clay text-sand text-[10px] font-semibold flex items-center justify-center">
          {cartCount > 9 ? '9+' : cartCount}
        </span>
      )}
    </a>
  );

  return (
    <nav className={`relative border-b border-ink/10 bg-sand ${hiddenOnMobile}`}>
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        <a href="/" className="font-display text-xl shrink-0">BuyLink</a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</a>
          ))}
          {isAdmin && <a href="/admin" className="text-clay whitespace-nowrap">Admin</a>}
          <a href={accountLink.href} className={linkClass(accountLink.href)}>{accountLink.label}</a>
          {cartButton}
        </div>

        {/* Mobile */}
        <div className="md:hidden flex items-center -mr-2">
          {cartButton}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="flex flex-col gap-1.5 p-3"
          >
            <span className={`block w-5 h-0.5 bg-ink transition-transform ${menuOpen ? 'translate-y-2 rotate-45' : ''}`} />
            <span className={`block w-5 h-0.5 bg-ink transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-ink transition-transform ${menuOpen ? '-translate-y-2 -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden absolute left-0 right-0 top-full z-50 flex flex-col border-b border-ink/10 bg-sand px-4 py-2 shadow-lg">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={`py-3 text-[15px] ${linkClass(l.href)}`}>
              {l.label}
            </a>
          ))}
          {isAdmin && <a href="/admin" className="py-3 text-[15px] text-clay">Admin</a>}
          <a href={accountLink.href} className={`py-3 text-[15px] ${linkClass(accountLink.href)}`}>
            {accountLink.label}
          </a>
        </div>
      )}
    </nav>
  );
}
