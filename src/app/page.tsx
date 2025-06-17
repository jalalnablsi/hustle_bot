
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { UserBalanceCard } from "@/components/dashboard/UserBalanceCard";
import { DailyRewardCard } from "@/components/dashboard/DailyRewardCard";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { useUser } from '@/contexts/UserContext';
import { Loader2, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const { currentUser, loadingUser, telegramAuthError } = useUser();

  if (loadingUser && !currentUser && !telegramAuthError) {
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
            <p className="text-xs text-muted-foreground">If this issue persists, try relaunching the app from Telegram or clearing browser data for this site.</p>
        </div>
      </AppShell>
    );
  }

  if (!loadingUser && !currentUser && !telegramAuthError) {
     return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4 text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-3">Welcome to HustleSoul!</h2>
            <p className="text-muted-foreground mb-6">Please launch the app through Telegram to access your profile.</p>
        </div>
      </AppShell>
    );
  }
  
  // Fallback if currentUser is still null after loading and no specific error.
  if (!currentUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading user data... Please ensure the app is launched via Telegram.</p>
        </div>
      </AppShell>
    );
  }
  
  // If currentUser is available, show the dashboard
  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">
            Welcome to HustleSoul{currentUser.first_name ? `, ${currentUser.first_name}` : ''}!
          </h1>
          <p className="text-lg text-muted-foreground">
            Your hub for earning GOLD & DIAMOND tokens. Complete tasks, refer friends, and engage daily.
          </p>
        </div>

        {/* Standard Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <UserBalanceCard />
            {/* Ad Banner Placeholder can go here if needed, or within QuickActionGrid */}
          </div>
          <div className="lg:col-span-1 space-y-6">
            <DailyRewardCard />
          </div>
        </div>
        
        <QuickActionGrid />
        
      </div>
      <script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="samplebot" data-size="large" data-onauth="onTelegramAuth(user)" data-request-access="write"></script>
<script type="text/javascript">
  function onTelegramAuth(user) {
    alert('Logged in as ' + user.first_name + ' ' + user.last_name + ' (' + user.id + (user.username ? ', @' + user.username : '') + ')');
  }
</script>
    </AppShell>
  );
}
