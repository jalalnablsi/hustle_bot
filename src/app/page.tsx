
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
  id: number; // Telegram IDs are numbers
  first_name: string;
  last_name?: string;
  username?: string;
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

      if ((window as any).Telegram?.WebApp?.initDataUnsafe?.user) {
        tgUser = (window as any).Telegram.WebApp.initDataUnsafe.user as TelegramWebAppUser;
      } else {
        const storedMockIdStr = localStorage.getItem('mockTelegramUserId_hustlesoul');
        const mockId = storedMockIdStr ? parseInt(storedMockIdStr, 10) : 7777; // Default mock Telegram ID

        tgUser = {
          id: mockId,
          first_name: 'DevUser',
          username: `devsoul${mockId}`,
        };
        console.warn("Telegram WebApp not found or no user data, using mock Telegram user:", tgUser);
        if (!storedMockIdStr) {
            localStorage.setItem('mockTelegramUserId_hustlesoul', mockId.toString());
        }
      }

      if (tgUser) {
        await fetchUserFromBackend(tgUser);
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

  const fetchUserFromBackend = async (tgUser: TelegramWebAppUser) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: tgUser.id.toString(),
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          username: tgUser.username,
        }),
      });

      if (!response.ok) {
        let errorBody = `API request failed with status ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorBody = errorData.error;
          }
        } catch (e) {
          try {
            const textError = await response.text();
            console.error("API error response (not JSON):", textError);
            errorBody = `API request failed with status ${response.status}. Server response: ${textError.substring(0, 100)}...`;
          } catch (readError) {
            console.error("Failed to read API error response text:", readError);
          }
        }
        throw new Error(errorBody);
      }

      const data = await response.json();

      if (data.success && data.user) {
        const fetchedUser = data.user as AppUser;
        const isNewUser = data.isNewUser;

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
          validatedUser.gold_points += WELCOME_BONUS_GOLD;
          validatedUser.diamond_points += WELCOME_BONUS_DIAMONDS;

          // 1. التحقق مما إذا كان المستخدم انضم عبر رابط إحالة
          const referrerIdFromLocalStorage = localStorage.getItem('referrer_id');

          if (referrerIdFromLocalStorage) {
            try {
              // 2. إرسال طلب تفعيل الإحالة
              const activateRes = await fetch('/api/referrals/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: validatedUser.id }),
              });

              const activateData = await activateRes.json();

              if (activateData.success) {
                // 3. تحديث النقاط والمكافآت
                validatedUser.gold_points = Number(activateData.referred_gold);
                validatedUser.bonus_spins_available = Number(activateData.referrer_spins);

                toast({
                  title: 'Referral Activated!',
                  description: 'You earned extra points for joining via a referral link.',
                  icon: <Users className="h-6 w-6 text-primary" />,
                  duration: 5000,
                });
              } else {
                console.warn('Referral activation failed:', activateData.error);
              }
            } catch (activationError) {
              console.error('Error activating referral:', activationError);
            }
          }

          toast({
            title: 'Welcome to HustleSoul!',
            description: (
              <div className="flex flex-col gap-1">
                <span>You've received a welcome bonus:</span>
                <span className="flex items-center">
                  <Coins className="h-4 w-4 mr-1 text-yellow-500" /> {WELCOME_BONUS_GOLD} Gold
                </span>
                <span className="flex items-center">
                  <Gem className="h-4 w-4 mr-1 text-sky-400" /> {WELCOME_BONUS_DIAMONDS} Diamond
                </span>
              </div>
            ),
            icon: <PartyPopper className="h-6 w-6 text-primary" />,
            duration: 7000,
          });
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
          gold_points: 500, diamond_points: 0.5000, purple_gem_points: 1.000, blue_gem_points: 0,
          referral_link: `https://t.me/HustleSoulBot?start=${mockTelegramIdForFallback}`,
          referrals_made: 2, initial_free_spin_used: true, ad_spins_used_today_count: 0, bonus_spins_available: 1,
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
          <h1 className="font-headline text-4xl font-bold text-foreground mb-2">
            Welcome to HustleSoul!
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

        <Card className="mt-8 bg-card/50">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Announcements</CardTitle>
            <CardDescription>Latest updates from the HustleSoul team.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No new announcements right now. Stay tuned!</p>
            {/* Example of an announcement item */}
            {/* <div className="mt-4 p-3 bg-primary/10 rounded-md border border-primary/20">
              <h3 className="font-semibold text-primary">New Game Added!</h3>
              <p className="text-sm text-foreground/80">Check out "Crypto Runner" in the Games section and earn bonus GOLD!</p>
            </div> */}
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
