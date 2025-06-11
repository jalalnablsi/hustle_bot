
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, Users, Trophy, Gamepad2, Gift } from 'lucide-react'; // Added Gift
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/referrals', label: 'Referrals', icon: Users },
  { href: '/wheel', label: 'Wheel', icon: Gift }, // Added Wheel
  { href: '/leaderboard', label: 'Leaders', icon: Trophy },
  { href: '/games', label: 'Games', icon: Gamepad2 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="mx-auto grid h-16 max-w-md grid-cols-6 items-center px-2"> {/* Updated to grid-cols-6 */}
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center space-y-1 rounded-md p-2 text-sm font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className={cn('h-5 w-5 sm:h-6 sm:w-6', isActive && item.href === '/wheel' ? 'fill-primary stroke-primary-foreground' : isActive ? 'text-primary' : '')} />
              <span className="text-xs truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
