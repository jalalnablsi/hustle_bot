
'use client';

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Users, Gift, TrendingUp, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock data - In a real app, this would come from user state/API
const referralCode = "HUSTLE123XYZ";
const referralsCount = 15;
const referralEarnings = 750; // GOLD
const referredUsers = [
  { name: "UserAlpha", joined: "2024-07-20", earningsFrom: 50 },
  { name: "BetaUser", joined: "2024-07-19", earningsFrom: 50 },
  { name: "GammaUser12", joined: "2024-07-18", earningsFrom: 50 },
];

export default function ReferralsPage() {
  const { toast } = useToast();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast({
      title: "Copied to Clipboard!",
      description: "Your referral code has been copied.",
    });
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Share2 className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Referral Program</h1>
          <p className="text-lg text-muted-foreground">
            Invite friends to HustleSoul and earn GOLD tokens for each successful referral!
          </p>
        </div>

        <Card className="mb-8 shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
              <Gift className="h-6 w-6" /> Your Referral Code
            </CardTitle>
            <CardDescription>Share this code with your friends.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center space-x-2">
            <Input type="text" value={referralCode} readOnly className="text-lg font-mono" />
            <Button onClick={handleCopyCode} variant="outline" size="icon" aria-label="Copy referral code">
              <Copy className="h-5 w-5" />
            </Button>
          </CardContent>
          <CardFooter>
            <Button className="w-full" size="lg">
              <Share2 className="mr-2 h-5 w-5" /> Share Now
            </Button>
          </CardFooter>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Referrals</CardTitle>
              <Users className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="font-headline text-3xl font-bold text-foreground">{referralsCount}</div>
              <p className="text-xs text-muted-foreground">friends joined through you</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Referral Earnings</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="font-headline text-3xl font-bold text-foreground">{referralEarnings} GOLD</div>
              <p className="text-xs text-muted-foreground">earned from referrals</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground">Referred Users</CardTitle>
            <CardDescription>Users who joined using your referral code.</CardDescription>
          </CardHeader>
          <CardContent>
            {referredUsers.length > 0 ? (
              <ul className="space-y-3">
                {referredUsers.map((user, index) => (
                  <li key={index} className="flex items-center justify-between p-3 bg-card-foreground/5 rounded-md">
                    <div>
                      <p className="font-semibold text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">Joined: {user.joined}</p>
                    </div>
                    <span className="text-sm font-medium text-green-500">+{user.earningsFrom} GOLD</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No referrals yet. Start sharing your code!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
