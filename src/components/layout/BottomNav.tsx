
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, Users, Trophy, Gamepad2, Gift, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/referrals', label: 'Referrals', icon: Users },
  { href: '/wheel', label: 'Wheel', icon: Gift },
  { href: '/ads', label: 'Watch & Earn', icon: Tv },
  { href: '/leaderboard', label: 'Leaders', icon: Trophy },
  { href: '/games', label: 'Games', icon: Gamepad2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-7 items-center px-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center space-y-1 rounded-md p-1.5 text-sm font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive && (item.icon === Gift || item.icon === Tv) ? 'fill-primary stroke-primary-foreground' : isActive ? 'text-primary' : '')} />
              <span className="text-[0.6rem] leading-tight text-center truncate w-full">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

    