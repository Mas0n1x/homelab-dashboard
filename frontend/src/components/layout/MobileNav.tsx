'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { NAV_ITEMS, getIcon } from '@/lib/constants';

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-nav border-t border-b-0 border-white/[0.06]">
      <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(item => {
          const Icon = getIcon(item.icon);
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200',
                isActive
                  ? 'text-accent-light'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
