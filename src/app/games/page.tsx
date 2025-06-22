
'use client';

import React from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { SkyHighStackerGame } from "@/components/games/sky-high-stacker/SkyHighStackerGame";
import { useUser } from '@/contexts/UserContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GamePage() {
  const { currentUser, loadingUser, telegramAuthError } = useUser();

  if (loadingUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading Game...</p>
        </div>
      </AppShell>
    );
  }
  
  if (telegramAuthError || !currentUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-3">{telegramAuthError ? "Authentication Error" : "Login Required"}</h2>
            <p className="text-muted-foreground mb-6">{telegramAuthError || "Please launch the app via Telegram to play."}</p>
            <Button onClick={() => window.location.reload()} variant="outline">Relaunch App</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
        <SkyHighStackerGame />
    </AppShell>
  );
}
