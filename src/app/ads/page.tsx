'use client';

import { useState } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaySquare, Gift, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function AdsPage() {
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const { toast } = useToast();

  const handleWatchAd = () => {
    setIsWatchingAd(true);
    setRewardClaimed(false);
    setAdProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10; // Simulate 10 second ad
      setAdProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        // setIsWatchingAd(false); // Keep ad visible until claim
      }
    }, 1000);
  };

  const handleClaimReward = () => {
    setRewardClaimed(true);
    setIsWatchingAd(false); // Hide ad after claim
    setAdProgress(0);
    toast({
        title: "Reward Claimed!",
        description: "You've earned 20 SOUL for watching an ad.",
    });
    // TODO: Add logic to update user's SOUL balance
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <PlaySquare className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Watch & Earn</h1>
          <p className="text-lg text-muted-foreground">
            Watch short advertisements to earn HustleSoul tokens.
          </p>
        </div>

        <Card className="max-w-xl mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground">Current Ad Opportunity</CardTitle>
            <CardDescription className="text-muted-foreground">
              {rewardClaimed ? "You've claimed your reward for this ad." : isWatchingAd && adProgress < 100 ? "Ad playing..." : "Watch an ad to earn 20 SOUL."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isWatchingAd ? (
              <div className="space-y-4">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  {/* Placeholder for ad content. In a real scenario, an ad SDK would render here. */}
                  <Image src="https://placehold.co/1280x720.png?text=Ad+Playing" alt="Advertisement" width={1280} height={720} data-ai-hint="advertisement video" />
                </div>
                <Progress value={adProgress} className="w-full" />
                {adProgress >= 100 && !rewardClaimed && (
                  <p className="text-sm text-green-500 text-center">Ad finished! You can now claim your reward.</p>
                )}
              </div>
            ) : rewardClaimed ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <p className="text-lg font-semibold text-foreground">Reward Claimed!</p>
                <p className="text-muted-foreground">Check back later for more ad opportunities.</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No ad currently playing. Click below to start.</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {isWatchingAd && adProgress >= 100 && !rewardClaimed ? (
              <Button onClick={handleClaimReward} className="w-full" size="lg">
                <Gift className="mr-2 h-5 w-5" /> Claim 20 SOUL
              </Button>
            ) : !isWatchingAd && !rewardClaimed ? (
              <Button onClick={handleWatchAd} className="w-full animate-pulse-glow" size="lg">
                <PlaySquare className="mr-2 h-5 w-5" /> Watch Ad
              </Button>
            ) : (
                 <Button className="w-full" size="lg" disabled>
                {isWatchingAd ? "Watching Ad..." : "Come Back Later"}
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
