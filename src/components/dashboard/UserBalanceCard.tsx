
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Gem } from "lucide-react";
import type { AppUser } from '@/app/types';
import { useEffect, useState } from 'react';

export function UserBalanceCard() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
     const fetchUserData = async () => {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setUser(data.user);
                } else {
                    console.warn("UserBalanceCard: Failed to load user data", data.error);
                }
            } else {
                 console.warn("UserBalanceCard: API error fetching user data", response.status);
            }
        } catch (error) {
            console.error("UserBalanceCard: Error fetching user data", error);
        }
    };
    fetchUserData();
    
    const handleUserUpdate = (event: Event) => {
        const customEvent = event as CustomEvent<AppUser>;
        setUser(customEvent.detail);
    };
    window.addEventListener('userUpdated_hustlesoul', handleUserUpdate as EventListener); // Updated event name
    return () => {
        window.removeEventListener('userUpdated_hustlesoul', handleUserUpdate as EventListener); // Updated event name
    };
  }, []);

  const goldBalance = user?.gold_points ?? 0;
  const diamondBalance = user?.diamond_points ?? 0;

  return (
    <Card className="shadow-xl hover:shadow-primary/30 transition-shadow duration-300 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-headline text-foreground">Your Wallet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-start p-4 bg-background/70 rounded-lg shadow-inner gap-4">
          <Coins className="h-10 w-10 text-yellow-400 flex-shrink-0" />
          <div className="overflow-hidden">
            <div className="text-sm text-muted-foreground">GOLD Balance</div>
            <div className="font-headline text-3xl font-bold text-foreground truncate" title={goldBalance.toLocaleString()}>
              {goldBalance.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-start p-4 bg-background/70 rounded-lg shadow-inner gap-4">
          <Gem className="h-10 w-10 text-sky-400 flex-shrink-0" />
          <div className="overflow-hidden">
            <div className="text-sm text-muted-foreground">DIAMOND Balance</div>
            <div className="font-headline text-3xl font-bold text-foreground truncate" title={diamondBalance.toLocaleString()}>
              {diamondBalance.toLocaleString()}
            </div>
          </div>
        </div>
         <p className="text-xs text-muted-foreground pt-2 text-center">
          Keep hustling to earn more rewards!
        </p>
      </CardContent>
    </Card>
  );
}
