
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, CheckCircle2, Loader2, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/contexts/UserContext';

const TWENTY_FOUR_HOURS_IN_MS = 24 * 60 * 60 * 1000;

function canClaimReward(lastClaimTimestamp: string | null | undefined): boolean {
    if (!lastClaimTimestamp) return true;
    const lastClaimDate = new Date(lastClaimTimestamp);
    return (new Date().getTime() - lastClaimDate.getTime()) >= TWENTY_FOUR_HOURS_IN_MS;
}

export function DailyRewardCard() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();
  const { toast } = useToast();

  const [isClaimable, setIsClaimable] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (contextLoadingUser) return;
    
    const lastClaimAt = currentUser?.last_daily_reward_claim_at;
    const canClaimNow = canClaimReward(lastClaimAt);
    setIsClaimable(canClaimNow);
    
    let intervalId: NodeJS.Timeout | undefined;

    if (!canClaimNow && lastClaimAt) {
      const updateTimer = () => {
        const nextClaimTime = new Date(lastClaimAt).getTime() + TWENTY_FOUR_HOURS_IN_MS;
        const diff = nextClaimTime - new Date().getTime();

        if (diff <= 0) {
          setTimeLeft('Ready!');
          setIsClaimable(true); 
          if(intervalId) clearInterval(intervalId);
          return;
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
      };
      updateTimer(); 
      intervalId = setInterval(updateTimer, 1000);
    } else {
      setTimeLeft(''); 
    }
    return () => clearInterval(intervalId);
  }, [currentUser, contextLoadingUser, isClaimable]);

  const handleClaimDailyReward = async () => {
    if (!currentUser?.id) {
      toast({ title: 'Error', description: 'User not identified.', variant: 'destructive' });
      return;
    }
    if (!isClaimable) {
      toast({ title: 'Not Yet', description: 'You have already claimed your reward recently.', variant: 'default' });
      return;
    }

    setIsClaiming(true);
    try {
      const res = await fetch('/api/daily-reward/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();

      if (data.success) {
        updateUserSession({
          gold_points: data.goldPoints,
          daily_reward_streak: data.dailyRewardStreak,
          last_daily_reward_claim_at: data.claimedAt,
        });
        setIsClaimable(false);
        toast({
          title: 'Daily Reward Claimed!',
          description: `You earned ${data.rewardAmount} GOLD. Streak: ${data.dailyRewardStreak} day(s)!`,
          icon: <Coins className="h-6 w-6 text-yellow-500" />,
        });
      } else {
        toast({
          title: 'Claim Failed',
          description: data.error || 'Could not claim reward.',
          variant: 'destructive',
        });
        if (data.nextClaimTime) {
             updateUserSession({ last_daily_reward_claim_at: new Date(new Date(data.nextClaimTime).getTime() - TWENTY_FOUR_HOURS_IN_MS).toISOString() });
             setIsClaimable(false);
        }
      }
    } catch (error) {
      console.error('Failed to claim daily reward:', error);
      toast({
        title: 'Server Error',
        description: 'Could not claim reward. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (contextLoadingUser && !currentUser) {
    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-xl text-foreground">
                  <Gift className="h-6 w-6 text-primary" />
                  <span>Daily Login Reward</span>
                </CardTitle>
                <CardDescription className="text-muted-foreground">Loading reward status...</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center items-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
        </Card>
    );
  }
   if (!currentUser) {
    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2 text-xl text-foreground">
                  <Gift className="h-6 w-6 text-primary" />
                  <span>Daily Login Reward</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-6">
                <p className="text-muted-foreground">Log in to claim your daily reward.</p>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-lg hover:shadow-primary/50 transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-xl text-foreground">
          <Gift className="h-6 w-6 text-primary" />
          <span>Daily Login Reward</span>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {!isClaimable ? "You've claimed your reward for today." : `Claim your daily GOLD! Streak: ${currentUser?.daily_reward_streak || 0} days.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isClaimable ? (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
            <p className="text-lg font-semibold text-foreground">Come back later!</p>
            {timeLeft && <p className="text-sm text-muted-foreground">Next claim in: {timeLeft}</p>}
          </div>
        ) : (
          <Button onClick={handleClaimDailyReward} className="w-full animate-pulse-glow" size="lg" disabled={isClaiming || contextLoadingUser}>
            {isClaiming ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gift className="mr-2 h-5 w-5" />}
            {isClaiming ? "Claiming..." : "Claim Daily Gold"}
          </Button>
        )}
      </CardContent> 
    </Card>
  );
}
