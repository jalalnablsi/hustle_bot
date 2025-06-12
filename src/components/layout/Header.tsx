
'use client';
import Link from 'next/link';
import { Coins, Gem } from 'lucide-react';
import type { AppUser } from '@/app/types';
import { useEffect, useState, useCallback } from 'react'; 
import { useToast } from "@/hooks/use-toast"; 

export function Header() {
  const [user, setUser] = useState<AppUser | null>(null);
  const { toast } = useToast(); 

  const fetchUserData = useCallback(async (isAfterTestLoginAttempt = false) => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          window.dispatchEvent(new CustomEvent<AppUser>('userUpdated_hustlesoul', { detail: data.user }));
          return data.user; 
        }
      }
      
      if (!isAfterTestLoginAttempt) { 
        return null; 
      }
      setUser(null); 
      window.dispatchEvent(new CustomEvent<AppUser | null>('userUpdated_hustlesoul', { detail: null }));


    } catch (error) {
      console.error("Failed to fetch user for header", error);
      if (!isAfterTestLoginAttempt) {
        return null; 
      }
      setUser(null);
      window.dispatchEvent(new CustomEvent<AppUser | null>('userUpdated_hustlesoul', { detail: null }));
    }
    return undefined; 
  }, []);


  useEffect(() => {
    const TEST_TELEGRAM_ID = "7777";
    const TEST_FIRST_NAME = "TestDev";
    const TEST_LAST_NAME = "User";
    const TEST_USERNAME = "testdev7777";

    const performTestLoginAndFetch = async () => {
      try {
        console.log("Attempting test login for Telegram ID:", TEST_TELEGRAM_ID);
        const loginResponse = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: TEST_TELEGRAM_ID,
            firstName: TEST_FIRST_NAME,
            lastName: TEST_LAST_NAME,
            username: TEST_USERNAME,
          }),
        });
        const loginData = await loginResponse.json();
        if (loginData.success) {
          console.log("Test login successful, new user:", loginData.isNewUser);
          await fetchUserData(true); 
        } else {
          console.error("Test login failed:", loginData.error);
          toast({ title: "Dev Login Failed", description: loginData.error, variant: "destructive"});
          setUser(null); 
          window.dispatchEvent(new CustomEvent<AppUser | null>('userUpdated_hustlesoul', { detail: null }));
        }
      } catch (error) {
        console.error("Error during test login:", error);
        toast({ title: "Dev Login Error", description: (error as Error).message, variant: "destructive"});
        setUser(null);
        window.dispatchEvent(new CustomEvent<AppUser | null>('userUpdated_hustlesoul', { detail: null }));
      }
    };

    const initializeUserSession = async () => {
      const currentUser = await fetchUserData(false); 
      if (currentUser === null && !(window as any).Telegram?.WebApp?.initDataUnsafe?.user) { 
         // Only run test login if not in actual Telegram environment and initial fetch failed
        await performTestLoginAndFetch();
      }
    };

    if (typeof window !== 'undefined') { // Ensure this runs only on client
        if ((window as any).Telegram?.WebApp?.initData) {
            (window as any).Telegram.WebApp.ready(); // Inform Telegram WebApp that the app is ready
            // If actual Telegram user data is present, prioritize it
            if ((window as any).Telegram.WebApp.initDataUnsafe?.user) {
                 initializeUserSession(); // This will try /api/auth/me, then /api/login with TG data
            } else {
                 initializeUserSession(); // Fallback to test login if no TG user but in TG env somehow
            }
        } else {
            // Not in Telegram environment, proceed with test login flow
            initializeUserSession();
        }
    }


    const handleUserUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<AppUser>;
      setUser(customEvent.detail);
    };
    window.addEventListener('userUpdated_hustlesoul', handleUserUpdate);
    return () => {
      window.removeEventListener('userUpdated_hustlesoul', handleUserUpdate);
    };
  }, [fetchUserData, toast]);

  const goldPoints = user?.gold_points ?? 0;
  const diamondPoints = user?.diamond_points ?? 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          {/* <Sparkles className="h-8 w-8 text-primary" /> */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          </svg>
          <span className="font-headline text-2xl font-bold text-foreground">HustleSoul</span>
        </Link>
        <div className="flex items-center space-x-2 md:space-x-3">
            <div className="flex items-center space-x-1 rounded-full bg-card px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm font-medium text-primary-foreground shadow-sm">
              <Coins className="h-4 w-4 md:h-5 md:w-5 text-yellow-400" />
              <span title={goldPoints.toLocaleString()}>{goldPoints.toLocaleString()}</span> 
              <span className="hidden sm:inline">GOLD</span>
            </div>
            <div className="flex items-center space-x-1 rounded-full bg-card px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm font-medium text-primary-foreground shadow-sm">
              <Gem className="h-4 w-4 md:h-5 md:w-5 text-sky-400" />
              <span title={diamondPoints.toLocaleString()}>{diamondPoints.toLocaleString()}</span>
            </div>
        </div>
      </div>
    </header>
  );
}
