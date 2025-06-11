
'use client';
import Link from 'next/link';
import { Coins, Gem } from 'lucide-react';
import type { AppUser } from '@/app/types';
import { useEffect, useState } from 'react';

export function Header() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    // Attempt to fetch user data if needed, or use a global state
    // For now, this is a placeholder. A proper app would use a context or fetch.
    const fetchUserData = async () => {
        try {
            const response = await fetch('/api/auth/me'); // Example endpoint
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setUser(data.user);
                }
            }
        } catch (error) {
            console.error("Failed to fetch user for header", error);
        }
    };
    fetchUserData();

    const handleUserUpdate = (event: Event) => {
        const customEvent = event as CustomEvent<AppUser>;
        setUser(customEvent.detail);
    };
    window.addEventListener('userUpdated_nofreetalk', handleUserUpdate);
    return () => {
        window.removeEventListener('userUpdated_nofreetalk', handleUserUpdate);
    };
  }, []);

  const goldPoints = user?.gold_points ?? 0;
  const diamondPoints = user?.diamond_points ?? 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
          <span className="font-headline text-2xl font-bold text-foreground">HustleSoul</span>
        </Link>
        <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm">
              <Coins className="h-5 w-5 text-yellow-400" />
              <span>{goldPoints.toLocaleString()} GOLD</span>
            </div>
            <div className="flex items-center space-x-1 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm">
              <Gem className="h-5 w-5 text-sky-400" />
              <span>{diamondPoints.toLocaleString()}</span>
            </div>
        </div>
      </div>
    </header>
  );
}
