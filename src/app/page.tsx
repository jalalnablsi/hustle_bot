
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { UserBalanceCard } from "@/components/dashboard/UserBalanceCard";
import { DailyRewardCard } from "@/components/dashboard/DailyRewardCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { useUser } from '@/contexts/UserContext';
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { currentUser, loadingUser, telegramAuthError, fetchUserData } = useUser();

  if (loadingUser) { 
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Initializing your HustleSoul session...</p>
        </div>
      </AppShell>
    );
  }
  
  if (telegramAuthError && !currentUser) { 
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-3">Authentication Error</h2>
            <p className="text-muted-foreground mb-6">{telegramAuthError}</p>
            <Button onClick={() => window.location.reload()} variant="outline">Try Relaunching App</Button>
            <p className="text-xs text-muted-foreground mt-3">If this persists, try fully closing and reopening Telegram, or clearing browser data for this site if accessed via web.</p>
        </div>
      </AppShell>
    );
  }

  if (!currentUser && !loadingUser && !telegramAuthError) {
     return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4 text-center">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-3">Welcome to HustleSoul!</h2>
            <p className="text-muted-foreground mb-6">Please launch the app through Telegram to access your profile and start earning.</p>
            {/* Removed button that calls fetchUserData directly as it might cause issues if initData is the problem */}
            <Button onClick={() => window.location.reload()} variant="outline">Relaunch App</Button>
        </div>
      </AppShell>
    );
  }
  
  if (!currentUser) { // Fallback if somehow currentUser is still null
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4 text-center">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-3">User Data Unavailable</h2>
          <p className="text-muted-foreground mb-6">Could not load your user profile. Please ensure the app is launched correctly via Telegram and try relaunching.</p>
          <Button onClick={() => window.location.reload()} variant="outline">Reload App</Button>
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
          <div className="lg:col-span-2 space-y-6">
            <UserBalanceCard />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <DailyRewardCard />
          </div>
        </div>
        
        <QuickActionGrid />
        
      </div>
    </AppShell>
  );
}
