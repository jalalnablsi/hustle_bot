
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Gem } from "lucide-react";
import { useUser } from '@/contexts/UserContext'; // Import useUser
import { Skeleton } from "@/components/ui/skeleton";

export function UserBalanceCard() {
  const { currentUser, loadingUser } = useUser(); // Use context

  const goldBalance = currentUser?.gold_points ?? 0;
  const diamondBalance = currentUser?.diamond_points ?? 0;

  if (loadingUser && !currentUser) {
    return (
      <Card className="shadow-xl bg-card">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-start p-4 bg-background/70 rounded-lg shadow-inner gap-4">
            <Coins className="h-10 w-10 text-yellow-400 flex-shrink-0" />
            <div className="overflow-hidden w-full">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          </div>
          <div className="flex items-center justify-start p-4 bg-background/70 rounded-lg shadow-inner gap-4">
            <Gem className="h-10 w-10 text-sky-400 flex-shrink-0" />
            <div className="overflow-hidden w-full">
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-1/2 mx-auto mt-2" />
        </CardContent>
      </Card>
    );
  }

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
