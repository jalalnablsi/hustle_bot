
'use client';

import { useState, useEffect } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaySquare, Gift, CheckCircle2, Loader2 } from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext"; // Import useUser

export default function AdsPage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession, fetchUserData } = useUser();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [rewardClaimedForThisAd, setRewardClaimedForThisAd] = useState(false); // Renamed for clarity
  const [isClaiming, setIsClaiming] = useState(false);
  const { toast } = useToast();
  
  // This ad page is a generic ad watching for GOLD.
  // The wheel page has its own ad-for-spin mechanism.
  const adRewardAmount = 20; // GOLD
  const adWatchDurationSeconds = 10; // Simulate 10 second ad

  useEffect(() => {
    // If user is not loaded, maybe show a loading state or disable actions
    if (!contextLoadingUser && !currentUser) {
        // Handle case where user is not available, e.g., redirect or show message
        toast({ title: "User not loaded", description: "Please ensure you are logged in to watch ads.", variant: "destructive" });
    }
  }, [currentUser, contextLoadingUser, toast]);


  const handleWatchAd = () => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "You must be logged in to watch ads.", variant: "destructive"});
      return;
    }
    setIsWatchingAd(true);
    setRewardClaimedForThisAd(false);
    setAdProgress(0);
    let progress = 0;
    const intervalTime = (adWatchDurationSeconds * 1000) / 100; // time per 1% progress
    const interval = setInterval(() => {
      progress += 1; 
      setAdProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, intervalTime);
  };

  const handleClaimReward = async () => {
    if (!currentUser) {
      toast({ title: "Claim Error", description: "User not identified.", variant: "destructive"});
      return;
    }
    setIsClaiming(true);
    try {
      // TODO: API Call - /api/ads/claim-generic-reward
      // For now, simulate success and update client-side context
      console.log("Simulating API call to /api/ads/claim-generic-reward for user:", currentUser.id);
      await new Promise(resolve => setTimeout(resolve, 700)); // Simulate network delay

      // Assuming API would return success and new gold balance
      const newGoldBalance = (currentUser.gold_points || 0) + adRewardAmount;
      updateUserSession({ gold_points: newGoldBalance });

      setRewardClaimedForThisAd(true);
      setIsWatchingAd(false); 
      setAdProgress(0);
      toast({
          title: "Reward Claimed!",
          description: `You've earned ${adRewardAmount} GOLD for watching an ad.`,
      });
      // Optionally, you might want to fetch full user data again if other things changed
      // fetchUserData(true); 

    } catch (error) {
        toast({ title: "Claim Failed", description: (error as Error).message || "Could not claim reward.", variant: "destructive"});
    } finally {
        setIsClaiming(false);
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
          <PlaySquare className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Watch & Earn</h1>
          <p className="text-lg text-muted-foreground">
            Watch short advertisements to earn HustleSoul GOLD tokens.
          </p>
        </div>

        <Card className="max-w-xl mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground">Current Ad Opportunity</CardTitle>
            <CardDescription className="text-muted-foreground">
              {rewardClaimedForThisAd ? "You've claimed your reward for this ad." : isWatchingAd && adProgress < 100 ? "Ad playing..." : `Watch an ad to earn ${adRewardAmount} GOLD.`}
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
                <p className="text-muted-foreground">Check back later for more ad opportunities.</p>
                 <Button onClick={() => { setIsWatchingAd(false); setRewardClaimedForThisAd(false); setAdProgress(0); }} className="mt-4" variant="outline">
                    Watch Another Ad
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No ad currently playing. Click below to start.</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {isWatchingAd && adProgress >= 100 && !rewardClaimedForThisAd ? (
              <Button onClick={handleClaimReward} className="w-full" size="lg" disabled={isClaiming}>
                {isClaiming ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Gift className="mr-2 h-5 w-5" />} 
                {isClaiming ? "Claiming..." : `Claim ${adRewardAmount} GOLD`}
              </Button>
            ) : !isWatchingAd && !rewardClaimedForThisAd ? (
              <Button onClick={handleWatchAd} className="w-full animate-pulse-glow" size="lg" disabled={!currentUser || contextLoadingUser}>
                <PlaySquare className="mr-2 h-5 w-5" /> Watch Ad
              </Button>
            ) : (
                 <Button className="w-full" size="lg" disabled>
                {isWatchingAd ? "Watching Ad..." : rewardClaimedForThisAd ? "Ad Watched" : "Come Back Later"}
              </Button>
            )}
          </CardFooter>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-4">
            Ads provided by partners. Future integration with Adsgrame.
        </p>
      </div>
    </AppShell>
  );
}
