
'use client';

import { AppShell } from "@/components/layout/AppShell";
import ArenaClashGame from "@/components/games/arena-clash/ArenaClashGame";
import { ArenaProvider } from '@/components/games/arena-clash/store';
import { useEffect } from "react";

export default function ArenaClashPage() {
  useEffect(() => {
    // Optional: If Telegram WebApp is used, expand to full screen
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.expand();
    }
  }, []);

  return (
    <AppShell>
      <ArenaProvider>
        <div className="flex flex-col items-center justify-start w-full min-h-[calc(100vh-var(--header-height,64px)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height,64px))] pt-2 pb-2 md:pt-4 md:pb-4 overflow-hidden">
          <ArenaClashGame />
        </div>
      </ArenaProvider>
    </AppShell>
  );
}
