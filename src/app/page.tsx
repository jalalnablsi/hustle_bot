
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { UserBalanceCard } from "@/components/dashboard/UserBalanceCard";
import { DailyRewardCard } from "@/components/dashboard/DailyRewardCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Coins, Gem, PartyPopper, Users, Loader2, Megaphone } from "lucide-react";
import { useUser } from '@/contexts/UserContext';
import { useEffect } from 'react'; // Added useEffect for Telegram WebApp ready

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
  const { toast } = useToast();

  // This effect runs once on mount to signal Telegram WebApp is ready.
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.ready();
    }
  }, []);


  // Login/User creation logic is now primarily handled by UserProvider.
  // This page can react to currentUser changes from the context.
  // If specific welcome toasts are needed, they could be triggered if UserProvider
  // exposes information about a new user session or if login API response is handled here.
  // For simplicity, keeping existing toast logic in UserProvider if it's already there.

  if (contextLoadingUser && !currentUser) {
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

        <Card className="mt-8 bg-card/70 border border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-accent" />
              Featured Promotion / Announcement
            </CardTitle>
            <CardDescription>This space can be used for important updates or sponsored content.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-[16/6] bg-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-border/60 p-6">
              <p className="text-muted-foreground text-center text-sm sm:text-base">
                ✨ Your Exciting Ad Content or Game Update Here! ✨<br/>
                <span className="text-xs">(This is a placeholder banner)</span>
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
    