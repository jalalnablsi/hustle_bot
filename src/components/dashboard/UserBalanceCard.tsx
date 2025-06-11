
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Gem } from "lucide-react";
import type { AppUser } from '@/app/types';
import { useEffect, useState } from 'react';

export function UserBalanceCard() {
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    // Placeholder: Fetch user data or use a global context
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
    window.addEventListener('userUpdated_nofreetalk', handleUserUpdate);
    return () => {
        window.removeEventListener('userUpdated_nofreetalk', handleUserUpdate);
    };
  }, []);

  const goldBalance = user?.gold_points ?? 0;
  const diamondBalance = user?.diamond_points ?? 0;

  return (
    <Card className="shadow-lg hover:shadow-primary/50 transition-shadow duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Your Balance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center">
          <Coins className="h-8 w-8 text-yellow-400 mr-3" />
          <div>
            <div className="font-headline text-3xl font-bold text-foreground">
              {goldBalance.toLocaleString()} <span className="text-xl text-primary">GOLD</span>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <Gem className="h-7 w-7 text-sky-400 mr-3" />
          <div>
            <div className="font-headline text-3xl font-bold text-foreground">
              {diamondBalance.toLocaleString()} <span className="text-xl text-sky-500">DIAMONDS</span>
            </div>
          </div>
        </div>
         <p className="text-xs text-muted-foreground pt-1">
          Keep hustling to earn more!
        </p>
      </CardContent>
    </Card>
  );
}
