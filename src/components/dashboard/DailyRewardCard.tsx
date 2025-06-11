'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DailyRewardCard() {
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

  const handleClaimReward = () => {
    // Mock claim logic
    setIsClaimedToday(true);
    localStorage.setItem('lastHustleSoulDailyClaim', new Date().toDateString());
    toast({
      title: "Reward Claimed!",
      description: "You've received 50 SOUL for your daily login.",
      variant: "default",
    });
  };

  return (
    <Card className="shadow-lg hover:shadow-primary/50 transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2 text-xl text-foreground">
          <Gift className="h-6 w-6 text-primary" />
          Daily Login Reward
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isClaimedToday ? "You've already claimed your reward for today." : "Claim your daily SOUL reward!"}
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
          <Button onClick={handleClaimReward} className="w-full animate-pulse-glow" size="lg">
            <Gift className="mr-2 h-5 w-5" /> Claim 50 SOUL
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
