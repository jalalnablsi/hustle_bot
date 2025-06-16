
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { UserBalanceCard } from "@/components/dashboard/UserBalanceCard";
import { DailyRewardCard } from "@/components/dashboard/DailyRewardCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { useUser } from '@/contexts/UserContext';
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { currentUser, loadingUser: contextLoadingUser } = useUser();

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
  
  // If user is not loaded and not loading (e.g. not logged in or error)
  if (!contextLoadingUser && !currentUser) {
    return (
       <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4 text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Welcome to HustleSoul!</h2>
            <p className="text-muted-foreground mb-6">Please ensure you are accessing the app via Telegram to load your profile.</p>
            {/* Add a refresh button or guidance if appropriate for your Telegram WebApp setup */}
            {/* <Button onClick={() => window.location.reload()}>Refresh</Button> */}
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
          <QuickActionGrid /> {/* Ad Banner is now part of QuickActionGrid */}
        </div>
        
      </div>
    </AppShell>
  );
}
