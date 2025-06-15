
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv, Gem, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

const AD_REWARD_DIAMOND_AMOUNT = 1;
const AD_WATCH_DURATION_SECONDS = 5; // Simulate 5 second ad

export default function AdsPage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [rewardClaimedForThisAd, setRewardClaimedForThisAd] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const adsWatchedToday = currentUser?.ad_views_today_count || 0;
  const dailyAdLimit = currentUser?.daily_ad_views_limit || 50; // Default limit
  const canWatchMoreAds = adsWatchedToday < dailyAdLimit;

  useEffect(() => {
    if (!contextLoadingUser && !currentUser) {
        toast({ title: "User Not Loaded", description: "Please ensure you are logged in to watch ads.", variant: "destructive" });
    }
  }, [currentUser, contextLoadingUser, toast]);

  const handleWatchAd = () => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "You must be logged in to watch ads.", variant: "destructive"});
      return;
    }
    if (!canWatchMoreAds) {
      toast({ title: "Daily Limit Reached", description: `You've watched the maximum ${dailyAdLimit} ads for today.`, variant: "default"});
      return;
    }
    setIsWatchingAd(true);
    setRewardClaimedForThisAd(false);
    setAdProgress(0);
    let progress = 0;
    const intervalTime = (AD_WATCH_DURATION_SECONDS * 1000) / 100;
    const interval = setInterval(() => {
      progress += 1;
      setAdProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, intervalTime);
  };

  const handleClaimReward = async () => {
    if (!currentUser?.id) {
      toast({ title: "Claim Error", description: "User not identified.", variant: "destructive"});
      return;
    }
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ads/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await response.json();

      if (data.success) {
        updateUserSession({
          diamond_points: data.totalDiamonds,
          ad_views_today_count: data.adViewsToday,
        });
        setRewardClaimedForThisAd(true);
        setIsWatchingAd(false);
        setAdProgress(0);
        toast({
            title: "Reward Claimed!",
            description: <span className="flex items-center">You've earned {AD_REWARD_DIAMOND_AMOUNT} <Gem className="h-4 w-4 ml-1 text-sky-400" />!</span>,
            icon: <Gem className="h-6 w-6 text-sky-400"/>
        });
      } else {
        throw new Error(data.error || "Failed to claim reward from server.");
      }
    } catch (error) {
        toast({ title: "Claim Failed", description: (error as Error).message || "Could not claim reward.", variant: "destructive"});
    } finally {
        setIsProcessing(false);
    }
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
              {rewardClaimedForThisAd ? "You've claimed your reward for this ad." : isWatchingAd && adProgress < 100 ? "Ad playing..." : `Watch an ad to earn ${AD_REWARD_DIAMOND_AMOUNT} DIAMOND.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isWatchingAd ? (
              <div className="space-y-4">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  <Image src="https://placehold.co/1280x720.png?text=Ad+Playing" alt="Advertisement" width={1280} height={720} data-ai-hint="advertisement video" />
                </div>
                <Progress value={adProgress} className="w-full" />
                {adProgress >= 100 && !rewardClaimedForThisAd && (
                  <p className="text-sm text-green-500 text-center">Ad finished! You can now claim your reward.</p>
                )}
              </div>
            ) : rewardClaimedForThisAd ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-semibold text-foreground">Reward Claimed!</p>
                <p className="text-muted-foreground">Check back later or watch another if available.</p>
                 <Button onClick={() => { setIsWatchingAd(false); setRewardClaimedForThisAd(false); setAdProgress(0); }} className="mt-4" variant="outline" disabled={!canWatchMoreAds}>
                    {canWatchMoreAds ? "Watch Another Ad" : "Daily Limit Reached"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                {canWatchMoreAds ? (
                  <p className="text-muted-foreground mb-4">No ad currently playing. Click below to start.</p>
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
            {isWatchingAd && adProgress >= 100 && !rewardClaimedForThisAd ? (
              <Button onClick={handleClaimReward} className="w-full" size="lg" disabled={isProcessing}>
                {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Gem className="mr-2 h-5 w-5 text-sky-300" />}
                {isProcessing ? "Claiming..." : `Claim ${AD_REWARD_DIAMOND_AMOUNT} DIAMOND`}
              </Button>
            ) : !isWatchingAd && !rewardClaimedForThisAd && canWatchMoreAds ? (
              <Button onClick={handleWatchAd} className="w-full animate-pulse-glow" size="lg" disabled={!currentUser || contextLoadingUser || !canWatchMoreAds}>
                <Tv className="mr-2 h-5 w-5" /> Watch Ad
              </Button>
            ) : (
                 <Button className="w-full" size="lg" disabled>
                {isWatchingAd ? "Watching Ad..." : rewardClaimedForThisAd ? "Ad Watched" : !canWatchMoreAds ? "Daily Limit Reached" : "Watch Ad"}
              </Button>
            )}
          </CardFooter>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-4">
            Ads are for earning in-app currency.
        </p>
      </div>
    </AppShell>
  );
}
