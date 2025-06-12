
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { UserBalanceCard } from "@/components/dashboard/UserBalanceCard";
import { useState, useEffect } from 'react';
import { DailyRewardCard } from "@/components/dashboard/DailyRewardCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { AppUser } from "@/app/types";
import { Coins, Gem, PartyPopper, Users } from "lucide-react";

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
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchOrCreateUser = async () => {
      setLoading(true);
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      let tgUser: TelegramWebAppUser | null = null;
      let referrerId: string | null = null;

      if ((window as any).Telegram?.WebApp?.initDataUnsafe?.user) {
        tgUser = (window as any).Telegram.WebApp.initDataUnsafe.user as TelegramWebAppUser;
        const startParam = (window as any).Telegram.WebApp.initDataUnsafe.start_param;
        if (startParam) {
            referrerId = startParam;
            localStorage.setItem('hustlesoul_referrer_id', referrerId); // Store for potential later use if login flow is complex
            console.log('Referrer ID from Telegram start_param:', referrerId);
        }
      } else {
        const storedMockIdStr = localStorage.getItem('mockTelegramUserId_hustlesoul');
        const mockId = storedMockIdStr ? parseInt(storedMockIdStr, 10) : 7777777; // Consistent Mock Telegram ID for testing

        tgUser = {
          id: mockId,
          first_name: 'DevSoul',
          username: `devsoul${mockId}`,
        };
        console.warn("Telegram WebApp not found or no user data, using mock Telegram user:", tgUser);
        if (!storedMockIdStr) {
            localStorage.setItem('mockTelegramUserId_hustlesoul', mockId.toString());
        }
        // Check for referrer in URL for mock environment
        const urlParams = new URLSearchParams(window.location.search);
        const urlReferrerId = urlParams.get('start');
        if (urlReferrerId) {
            referrerId = urlReferrerId;
            localStorage.setItem('hustlesoul_referrer_id', referrerId);
            console.log('Referrer ID from URL (mock env):', referrerId);
        }
      }
      
      // If not found in start_param or URL, check localStorage (e.g. from previous visit)
      if (!referrerId) {
        referrerId = localStorage.getItem('hustlesoul_referrer_id');
      }


      if (tgUser) {
        await fetchUserFromBackend(tgUser, referrerId);
      } else {
        setLoading(false);
        setCurrentUser(null);
        toast({
          title: 'Error',
          description: 'Could not identify Telegram user.',
          variant: 'destructive',
        });
      }
    };

    fetchOrCreateUser();

    const handleUserUpdate = (event: CustomEvent<AppUser>) => {
        setCurrentUser(event.detail);
    };
    window.addEventListener('userUpdated_hustlesoul', handleUserUpdate as EventListener);

    return () => {
        window.removeEventListener('userUpdated_hustlesoul', handleUserUpdate as EventListener);
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserFromBackend = async (tgUser: TelegramWebAppUser, referrerTelegramId: string | null) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgUser.id.toString(),
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
          referrerTelegramId: referrerTelegramId, // Send referrer ID to backend
        }),
      });

      if (!response.ok) {
        let errorBody = `API request failed with status ${response.status}: ${response.statusText}`;
        try { const errorData = await response.json(); if (errorData && errorData.error) errorBody = errorData.error; } catch (e) {/* ignore */}
        throw new Error(errorBody);
      }

      const data = await response.json();

      if (data.success && data.user) {
        const fetchedUser = data.user as AppUser;
        const isNewUser = data.isNewUser;
        const referralBonusApplied = data.referralBonusApplied; // Check if backend applied bonus

        const validatedUser: AppUser = {
          ...fetchedUser,
          id: fetchedUser.id,
          telegram_id: fetchedUser.telegram_id || tgUser.id.toString(),
          first_name: fetchedUser.first_name || tgUser.first_name,
          username: fetchedUser.username || tgUser.username || null,
          gold_points: Number(fetchedUser.gold_points) || 0,
          diamond_points: Number(fetchedUser.diamond_points) || 0,
          purple_gem_points: Number(fetchedUser.purple_gem_points) || 0,
          blue_gem_points: Number(fetchedUser.blue_gem_points) || 0,
          referrals_made: Number(fetchedUser.referrals_made) || 0,
          initial_free_spin_used: Boolean(fetchedUser.initial_free_spin_used),
          ad_spins_used_today_count: Number(fetchedUser.ad_spins_used_today_count) || 0,
          bonus_spins_available: Number(fetchedUser.bonus_spins_available) || 0,
          last_login: fetchedUser.last_login || new Date().toISOString(),
          created_at: fetchedUser.created_at || new Date().toISOString(),
          daily_reward_streak: Number(fetchedUser.daily_reward_streak) || 0,
          last_daily_reward_claim_at: fetchedUser.last_daily_reward_claim_at || null,
        };

        if (isNewUser) {
          // Welcome bonus is now handled by backend during user creation if they are new.
          // We can show a toast based on isNewUser flag.
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

          if (referralBonusApplied) {
             toast({
                title: 'Referral Bonus!',
                description: `You also received a bonus for joining via a referral! Gold: +${data.referralBonusGold}, Spins: +${data.referralBonusSpins}`,
                icon: <Users className="h-6 w-6 text-primary" />,
                duration: 6000,
             });
             localStorage.removeItem('hustlesoul_referrer_id'); // Clear after successful application
          }

        }
        setCurrentUser(validatedUser);
        window.dispatchEvent(new CustomEvent<AppUser>('userUpdated_hustlesoul', { detail: validatedUser }));
      } else {
        throw new Error(data.error || 'Failed to process user data from API');
      }
    } catch (error) {
      console.error('Error in fetchUserFromBackend:', error);
      toast({
        title: 'Error Loading Profile',
        description: (error as Error).message || 'Could not load your profile data. Using mock data.',
        variant: 'destructive',
      });
      const mockTelegramIdForFallback = tgUser?.id.toString() || localStorage.getItem('mockTelegramUserId_hustlesoul') || "mock_fallback_123";
      setCurrentUser({
          id: `mock-uuid-${mockTelegramIdForFallback}`,
          telegram_id: mockTelegramIdForFallback,
          first_name: 'DevUser (Offline)',
          last_name: 'Fallback',
          username: `devsoul_offline_${mockTelegramIdForFallback}`,
          gold_points: 500, diamond_points: 5, purple_gem_points: 1, blue_gem_points: 0,
          referral_link: `https://t.me/HustleSoulBot?start=${mockTelegramIdForFallback}`,
          referrals_made: 2, initial_free_spin_used: false, ad_spins_used_today_count: 0, bonus_spins_available: 1,
          last_login: new Date().toISOString(), created_at: new Date().toISOString(),
          daily_reward_streak: 1, last_daily_reward_claim_at: null,
      });
    } finally {
      setLoading(false);
    }
  };


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
            <CardTitle className="font-headline text-xl">Announcements</CardTitle>
            <CardDescription>Latest updates from the HustleSoul team.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No new announcements right now. Check back soon for exciting news & events!</p>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}

