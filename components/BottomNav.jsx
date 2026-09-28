'use client';

import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/feed', label: 'products', icon: '🌐' },
  { href: '/dashboard/posts/new', label: 'Post', icon: '➕' },
  { href: '/messages', label: 'Inbox', icon: '✉️' },
  { href: '/settings', label: 'Profile', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-sand border-t border-ink/10 flex justify-around z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <a
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs ${
              active ? 'text-clay' : 'text-ink/60'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
