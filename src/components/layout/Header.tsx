import Link from 'next/link';
import { Coins } from 'lucide-react';

export function Header() {
  // Mock user points
  const userPoints = 1250;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
          <span className="font-headline text-2xl font-bold text-foreground">HustleSoul</span>
        </Link>
        <div className="flex items-center space-x-2 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-md">
          <Coins className="h-5 w-5 text-yellow-400" />
          <span>{userPoints.toLocaleString()} SOUL</span>
        </div>
      </div>
    </header>
  );
}
