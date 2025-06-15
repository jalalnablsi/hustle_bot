
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/contexts/UserContext';
export function DailyRewardCard() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();
  const [isClaimedToday, setIsClaimedToday] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const { toast } = useToast();

  // Mock checking claim status and calculating time left
  useEffect(() => {
    const lastClaimDate = localStorage.getItem('lastHustleSoulDailyClaim');
    if (lastClaimDate) {
      const today = new Date().toDateString();
      if (lastClaimDate === today) {
        setIsClaimedToday(true);
      }
    }

    const interval = setInterval(() => {
      if (isClaimedToday) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const diff = tomorrow.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isClaimedToday]);

  const handleClaimDailyReward = async () => {
    if (!currentUser || !currentUser.id) {
      toast({
        title: 'Error',
        description: 'User ID not found.',
        variant: 'destructive',
      });
      return;
    }
  
    try {
      const res = await fetch('/api/daily-reward/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
  
      const data = await res.json();
  
      if (data.success) {
        const updatedUser = {
          ...currentUser,
          gold_points: data.goldPoints,
          daily_reward_streak: data.dailyRewardStreak,
          last_daily_reward_claim_at: data.claimedAt,
        };
  
        setCurrentUser(updatedUser);
        window.dispatchEvent(new CustomEvent<AppUser>('userUpdated_hustlesoul', { detail: updatedUser }));
  
        toast({
          title: 'Daily Reward Claimed!',
          description: `You earned ${data.rewardAmount} GOLD.`,
          icon: <Coins className="h-6 w-6 text-yellow-500" />,
        });
      } else {
        toast({
          title: 'Already Claimed',
          description: 'You have already claimed your reward today.',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Failed to claim daily reward:', error);
      toast({
        title: 'Server Error',
        description: 'Could not claim reward. Please try again later.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="shadow-lg hover:shadow-primary/50 transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-xl text-foreground">
          <Gift className="h-6 w-6 text-primary" />
          Daily Login Reward
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isClaimedToday ? "You've already claimed your reward for today." : "Claim your daily GOLD reward!"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isClaimedToday ? (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
            <p className="text-lg font-semibold text-foreground">Come back tomorrow!</p>
            <p className="text-sm text-muted-foreground">Next claim in: {timeLeft}</p>
          </div>
        ) : (
          <Button onClick={handleClaimDailyReward} className="w-full animate-pulse-glow" size="lg">
            <Gift className="mr-2 h-5 w-5" /> Claim 50 GOLD
          </Button>
        )}
      </CardContent> 
    </Card>
  );
}
