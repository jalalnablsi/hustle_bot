
'use client';
import { AppShell } from "@/components/layout/AppShell";
import SkyHighStackerGame from "@/components/games/sky-high-stacker/SkyHighStackerGame";
import { useEffect } from 'react';

export default function SkyHighStackerPage() {
  
  useEffect(() => {
    // Optional: If Telegram WebApp is used, expand to full screen
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.expand();
    }
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-start w-full min-h-[calc(100vh-var(--header-height,64px)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height,64px))] pt-2 pb-2 md:pt-4 md:pb-4 overflow-hidden">
        {/* The game itself will manage its max width and centering */}
        <SkyHighStackerGame />
      </div>
    </AppShell>
  );
}
