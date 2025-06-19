
'use client';

import React, { useState, useCallback } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv, Gem, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
// Progress component might not be needed if Adsgram handles its own UI
// import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useAdsgram } from '@/hooks/useAdsgram'; 

const ADSGRAM_DIAMOND_BLOCK_ID = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_DIAMOND || 'default-diamond-block-id';
const AD_REWARD_DIAMOND_AMOUNT = 1; // This is for UI display; actual reward from backend

export default function AdsPage() {
  const { currentUser, loadingUser: contextLoadingUser, fetchUserData } = useUser();
  const [isAdInProgress, setIsAdInProgress] = useState(false);
  const [lastAdWatchedAndProcessed, setLastAdWatchedAndProcessed] = useState(false);
  const { toast } = useToast();

  const adsWatchedToday = currentUser?.ad_views_today_count || 0; // General ad views counter
  const dailyAdLimit = currentUser?.daily_ad_views_limit || 50; 
  const canWatchMoreAds = adsWatchedToday < dailyAdLimit;

  const handleAdsgramReward = useCallback(() => {
    setLastAdWatchedAndProcessed(true);
    toast({
        title: "Ad Watched!",
        description: (
            <span className="flex items-center">
              Diamond reward is being processed. Refreshing data...
            </span>
        ),
        icon: <Gem className="h-6 w-6 text-sky-400"/>
    });
    // The actual reward is handled by server-to-server callback.
    // Refresh user data to reflect the new diamond count and ad views.
    setTimeout(() => { // Give a small delay for server to process
        fetchUserData();
    }, 2000); // Adjust delay as needed
    setIsAdInProgress(false);
  }, [toast, fetchUserData]);

  const handleAdsgramError = useCallback(() => {
    // Toast for error handled by useAdsgram hook
    setLastAdWatchedAndProcessed(false); // Ensure it's false on error
    setIsAdInProgress(false);
  }, []);
  
  const handleAdsgramClose = useCallback(() => {
    setIsAdInProgress(false);
  }, []);

  const showAdsgramAdForDiamond = useAdsgram({
    blockId: ADSGRAM_DIAMOND_BLOCK_ID,
    onReward: handleAdsgramReward,
    onError: handleAdsgramError,
    onClose: handleAdsgramClose,
  });

  const handleWatchAdClick = async () => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "You must be logged in to watch ads.", variant: "destructive"});
      return;
    }
    if (!canWatchMoreAds) {
      toast({ title: "Daily Limit Reached", description: `You've watched the maximum ${dailyAdLimit} ads for today.`, variant: "default"});
      return;
    }
    setLastAdWatchedAndProcessed(false); // Reset for new ad watch
    setIsAdInProgress(true);
    await showAdsgramAdForDiamond();
    // isAdInProgress will be set to false by onReward or onError callbacks of useAdsgram
  };

  if (contextLoadingUser && !currentUser) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }
  
  if (!currentUser && !contextLoadingUser) {
     return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))] p-4 text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-3">Login Required</h2>
            <p className="text-muted-foreground mb-6">Please launch the app via Telegram to watch ads.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Tv className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Watch & Earn Diamonds</h1>
          <p className="text-lg text-muted-foreground">
            Watch short advertisements to earn {AD_REWARD_DIAMOND_AMOUNT} <Gem className="inline h-5 w-5 text-sky-400" /> per ad.
          </p>
          <p className="text-sm text-muted-foreground mt-1">Ads watched today: {adsWatchedToday} / {dailyAdLimit}</p>
        </div>

        <Card className="max-w-xl mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground">Current Ad Opportunity</CardTitle>
            <CardDescription className="text-muted-foreground">
              {lastAdWatchedAndProcessed ? "You've completed an ad view. Reward is processing." : isAdInProgress ? "Ad loading/playing..." : `Watch an ad to earn ${AD_REWARD_DIAMOND_AMOUNT} DIAMOND.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAdInProgress ? (
              <div className="space-y-4 text-center py-8">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-3" />
                <p className="text-muted-foreground">Loading ad from Adsgram...</p>
                <p className="text-xs text-muted-foreground">(Adsgram handles the ad display)</p>
              </div>
            ) : lastAdWatchedAndProcessed ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-semibold text-foreground">Ad View Completed!</p>
                <p className="text-muted-foreground">Your reward is being processed by the server.</p>
                 <Button onClick={() => { setLastAdWatchedAndProcessed(false); }} className="mt-4" variant="outline" disabled={!canWatchMoreAds || isAdInProgress}>
                    {canWatchMoreAds ? "Watch Another Ad" : "Daily Limit Reached"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                {canWatchMoreAds ? (
                  <div className="flex flex-col items-center">
                     <Image src="https://placehold.co/300x200.png?text=Ready+to+Watch%3F" alt="Ready to watch ad" width={300} height={200} data-ai-hint="advertisement placeholder" className="rounded-lg mb-4 shadow-md" />
                     <p className="text-muted-foreground mb-4">Click below to watch an ad from Adsgram.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <AlertTriangle className="h-12 w-12 text-yellow-500 mb-3"/>
                    <p className="text-lg font-semibold text-foreground">Daily Ad Limit Reached</p>
                    <p className="text-muted-foreground">You've watched {dailyAdLimit} ads today. Come back tomorrow!</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            {!lastAdWatchedAndProcessed && canWatchMoreAds && (
              <Button onClick={handleWatchAdClick} className="w-full animate-pulse-glow" size="lg" disabled={!currentUser || contextLoadingUser || !canWatchMoreAds || isAdInProgress}>
                 {isAdInProgress ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Tv className="mr-2 h-5 w-5" />} 
                 {isAdInProgress ? 'Loading Ad...' : 'Watch Ad via Adsgram'}
              </Button>
            )}
            {(lastAdWatchedAndProcessed || !canWatchMoreAds) && (
                 <Button className="w-full" size="lg" disabled>
                  {lastAdWatchedAndProcessed ? "Ad Watched" : !canWatchMoreAds ? "Daily Limit Reached" : "Watch Ad"}
              </Button>
            )}
          </CardFooter>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-4">
            Ads are provided by Adsgram. Rewards are processed after server confirmation.
        </p>
      </div>
    </AppShell>
  );
}
