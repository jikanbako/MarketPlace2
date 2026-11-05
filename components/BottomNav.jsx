'use client';

import { usePathname } from 'next/navigation';
import { HomeIcon, CompassIcon, PlusIcon, InboxIcon, UserIcon } from '@/components/Icons';

const TABS = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon, exact: true },
  { href: '/feed', label: 'Feed', Icon: CompassIcon },
  { href: '/dashboard/posts/new', label: 'Post', Icon: PlusIcon, exact: true, primary: true },
  { href: '/messages', label: 'Inbox', Icon: InboxIcon },
  { href: '/settings', label: 'Profile', Icon: UserIcon },
];

// Total height = 3.5rem + the phone's bottom safe area. The feed page
// positions itself against exactly this value, so keep them in sync.
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sand/95 backdrop-blur border-t border-ink/10 grid grid-cols-5"
      style={{
        height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {TABS.map(({ href, label, Icon, exact, primary }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);

        if (primary) {
          return (
            <a key={href} href={href} aria-label={label} className="flex items-center justify-center">
              <span className="w-12 h-9 rounded-xl bg-clay text-sand flex items-center justify-center shadow-sm active:scale-95 transition-transform">
                <Icon size={22} />
              </span>
            </a>
          );
        }

        return (
          <a
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
              active ? 'text-clay font-medium' : 'text-ink/50'
            }`}
          >
            <Icon size={23} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
