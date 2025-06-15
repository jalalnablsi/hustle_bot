
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { UserBalanceCard } from "@/components/dashboard/UserBalanceCard";
import { useState, useEffect, useCallback } from 'react';
import { DailyRewardCard } from "@/components/dashboard/DailyRewardCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { AppUser } from "@/app/types";
import { Coins, Gem, PartyPopper, Users, Loader2, Megaphone } from "lucide-react";
import { useUser } from "@/contexts/UserContext"; 

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  is_bot?: boolean;
  language_code?: string;
  photo_url?: string;
}

const WELCOME_BONUS_GOLD = 100;
const WELCOME_BONUS_DIAMONDS = 1;

export default function DashboardPage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession, fetchUserData } = useUser();
  const [initialLoginAttempted, setInitialLoginAttempted] = useState(false);
  const { toast } = useToast();

  const handleLoginAndUserCreation = useCallback(async () => {
    if (initialLoginAttempted || (!contextLoadingUser && currentUser)) {
      return;
    }
    setInitialLoginAttempted(true);

    let tgUser: TelegramWebAppUser | null = null;
    let referrerId: string | null = null;

    if (typeof window !== 'undefined') {
      if ((window as any).Telegram?.WebApp?.initDataUnsafe?.user) {
        tgUser = (window as any).Telegram.WebApp.initDataUnsafe.user as TelegramWebAppUser;
        const startParam = (window as any).Telegram.WebApp.initDataUnsafe.start_param;
        if (startParam) {
          referrerId = startParam;
          localStorage.setItem('hustlesoul_referrer_id', referrerId);
        }
      } else {
        const storedMockIdStr = localStorage.getItem('mockTelegramUserId_hustlesoul');
        const mockId = storedMockIdStr ? parseInt(storedMockIdStr, 10) : Math.floor(100000000 + Math.random() * 900000000);
        tgUser = { id: mockId, first_name: 'DevSoul', username: `devsoul${mockId.toString().slice(0,5)}` };
        console.warn("Telegram WebApp user not found, using mock Telegram user for /api/login:", tgUser);
        if (!storedMockIdStr) localStorage.setItem('mockTelegramUserId_hustlesoul', mockId.toString());
        
        const urlParams = new URLSearchParams(window.location.search);
        const urlReferrerId = urlParams.get('start');
        if (urlReferrerId) {
          referrerId = urlReferrerId;
          localStorage.setItem('hustlesoul_referrer_id', referrerId);
        }
      }
      if (!referrerId) referrerId = localStorage.getItem('hustlesoul_referrer_id');
    }

    if (tgUser) {
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: tgUser.id.toString(),
            firstName: tgUser.first_name,
            lastName: tgUser.last_name,
            username: tgUser.username,
            referrerTelegramId: referrerId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Login API request failed: ${response.status}`);
        }
        const data = await response.json();

        if (data.success && data.user) {
          updateUserSession(data.user); 
          if (data.isNewUser) {
            toast({
              title: 'Welcome to HustleSoul!',
              description: (
                <div className="flex flex-col gap-1">
                  <span>You've received a welcome bonus!</span>
                  <span className="flex items-center">
                    <Coins className="h-4 w-4 mr-1 text-yellow-500" /> {data.welcomeBonusGold || WELCOME_BONUS_GOLD} Gold
                  </span>
                  <span className="flex items-center">
                    <Gem className="h-4 w-4 mr-1 text-sky-400" /> {data.welcomeBonusDiamonds || WELCOME_BONUS_DIAMONDS} Diamond
                  </span>
                </div>
              ),
              icon: <PartyPopper className="h-6 w-6 text-primary" />,
              duration: 7000,
            });
            if (data.referralBonusApplied) {
              toast({
                title: 'Referral Bonus!',
                description: `You also received a bonus for joining via a referral! Gold: +${data.referralBonusGold}, Spins: +${data.referralBonusSpins}`,
                icon: <Users className="h-6 w-6 text-primary" />,
                duration: 6000,
              });
              localStorage.removeItem('hustlesoul_referrer_id');
            }
          }
        } else {
          throw new Error(data.error || 'Failed to process user data from login API');
        }
      } catch (error) {
        console.error('Error in handleLoginAndUserCreation:', error);
        toast({
          title: 'Login Error',
          description: (error as Error).message || 'Could not log in or create user.',
          variant: 'destructive',
        });
        await fetchUserData(true);
      }
    } else {
       await fetchUserData(true); 
       if (!currentUser && !contextLoadingUser) {
          toast({ title: 'Error', description: 'Could not identify Telegram user.', variant: 'destructive' });
       }
    }
  }, [contextLoadingUser, currentUser, toast, updateUserSession, fetchUserData, initialLoginAttempted]);

  useEffect(() => {
    if (!contextLoadingUser && !currentUser && !initialLoginAttempted) {
      handleLoginAndUserCreation();
    }
     if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.ready();
    }
  }, [contextLoadingUser, currentUser, handleLoginAndUserCreation, initialLoginAttempted]);


  if (contextLoadingUser && !currentUser && !initialLoginAttempted) { // Show loader if context is loading AND user not set AND login not yet attempted
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your HustleSoul profile...</p>
        </div>
      </AppShell>
    );
  }
  
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">
            Welcome to HustleSoul{currentUser?.first_name ? `, ${currentUser.first_name}` : ''}!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your hub for earning GOLD & DIAMOND tokens. Complete tasks, refer friends, and engage daily.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UserBalanceCard />
          </div>
          <div>
            <DailyRewardCard />
          </div>
        </div>

        <div>
          <h2 className="font-headline text-2xl font-semibold text-foreground mb-4 mt-8">Quick Actions</h2>
          <QuickActionGrid />
        </div>

        <Card className="mt-8 bg-card/70">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-accent" />
              Advertisement Banner
            </CardTitle>
            <CardDescription>Sponsored content or important announcements could go here.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-muted/50 rounded-lg flex items-center justify-center border border-dashed border-border">
              <p className="text-muted-foreground text-sm">Your Ad Content Here</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}

    