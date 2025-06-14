
'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Users, Gift, TrendingUp, Share2, Coins, Gem, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppUser } from '@/app/types';

export default function ReferralsPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referrals, setReferrals] = useState<any[]>([]); // Consider defining a more specific type for referred user summary
  const [loading, setLoading] = useState<boolean>(true);
  const [claimLoading, setClaimLoading] = useState<boolean>(false);
  
  // For claimable rewards based on referral activity since last claim
  const [claimableGold, setClaimableGold] = useState<number>(0);
  const [claimableDiamonds, setClaimableDiamonds] = useState<number>(0);

  // For total lifetime referral earnings directly from user object
  const [totalLifetimeReferralGold, setTotalLifetimeReferralGold] = useState<number>(0);
  const [totalLifetimeReferralDiamonds, setTotalLifetimeReferralDiamonds] = useState<number>(0);

  const fetchReferralData = useCallback(async (userId: string, userTelegramId: string) => {
    try {
      const referralLink = `https://t.me/HustleSoulBot?start=${userTelegramId}`;
      setReferralCode(referralLink);

      const referralsResponse = await fetch(`/api/referrals/details?referrer_id=${userId}`);
      if (!referralsResponse.ok) {
        const errorData = await referralsResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch referral details. Status: ${referralsResponse.status}`);
      }
      const referralsData = await referralsResponse.json();

      if (!referralsData.success) {
        throw new Error(referralsData.error || 'Failed to process referral details.');
      }
      setReferrals(referralsData.referrals || []);

      // Calculate claimable rewards from the detailed referrals list
      // This logic assumes `earningsFrom` is current total points of referred user,
      // and `last_rewarded_gold/diamond` is the points snapshot when last claimed.
      // The 5% calculation should ideally happen on the backend during claim for security.
      // For display purposes, we might estimate it here, or the backend /referrals/details could provide claimable amounts.
      // For simplicity, let's assume `referralsData.referrals` does NOT provide directly claimable amounts,
      // and the claim API handles the calculation. So, we'll set claimable to 0 or derive from user object if available.
      // Or, better, the backend for /referrals/details could return a `claimable_gold` and `claimable_diamond` sum.
      // For now, let's assume the current `goldEarnings` and `diamondEarnings` (now `claimableGold`/`Diamonds`)
      // were placeholders and the actual claimable amount would be determined by the backend on claim.
      // We will rely on user's total referral earnings for the new card.

      // If your /api/referrals/details directly provided a sum of pending claimable rewards, you'd use that.
      // Example: setClaimableGold(referralsData.summary?.pendingGoldToClaim || 0);
      // For now, these will be set to 0 and the "Collect Rewards" button will enable if backend says there's something to claim,
      // or if we decide to re-implement the local calculation based on the referrals list.
      // Let's remove the local calculation for claimable and rely on the claim button to check with backend.
      // The button text can be generic "Check & Collect Rewards".
      
      // Let's assume the `/api/referrals/claim` endpoint returns the amounts if successful,
      // and `/api/auth/me` or `/api/referrals/details` can give a hint if there are pending rewards.
      // For now, we'll keep claimable amounts at 0 unless backend gives them.
      setClaimableGold(0); // This will be updated by a more sophisticated backend or removed.
      setClaimableDiamonds(0); // This will be updated or removed.

    } catch (error: any) {
      console.error('Error fetching referral details:', error.message);
      toast({
        title: 'Error Loading Referrals',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           throw new Error(errorData.error || `Failed to fetch user data. Status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error(data.error || 'User data not found.');
        }

        const user = data.user as AppUser;
        setCurrentUser(user);
        setTotalLifetimeReferralGold(Number(user.referral_gold_earned) || 0);
        // Ensure diamond parsing is robust
        const diamondVal = parseFloat(user.referral_diamond_earned as any);
        setTotalLifetimeReferralDiamonds(isNaN(diamondVal) ? 0 : diamondVal);
        
        await fetchReferralData(user.id!, user.telegram_id);

      } catch (error: any) {
        console.error('Error fetching initial data:', error.message);
        toast({
          title: 'Error',
          description: error.message || 'Could not load page data.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [toast, fetchReferralData]);

  const handleCopyCode = () => {
    if (referralCode) {
        navigator.clipboard.writeText(referralCode);
        toast({
          title: "Copied to Clipboard!",
          description: "Your referral code has been copied.",
        });
    }
  };

  const handleCollectRewards = async () => {
    if (!currentUser?.id) {
        toast({ title: 'Error', description: 'User not identified.', variant: 'destructive'});
        return;
    }
    setClaimLoading(true);
    try {
      const res = await fetch('/api/referrals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrer_id: currentUser.id }), // Ensure API uses this key
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Collected Successfully!',
          description: `You earned ${Number(data.goldEarned || 0).toFixed(2)} GOLD and ${Number(data.diamondEarned || 0).toFixed(4)} DIAMOND.`,
        });
        // Refresh user data to get updated totals and potentially clear claimable amounts
        if (currentUser.id && currentUser.telegram_id) {
            const userResponse = await fetch('/api/auth/me');
            const userData = await userResponse.json();
            if (userData.success && userData.user) {
                const updatedUser = userData.user as AppUser;
                setCurrentUser(updatedUser);
                setTotalLifetimeReferralGold(Number(updatedUser.referral_gold_earned) || 0);
                const diamondVal = parseFloat(updatedUser.referral_diamond_earned as any);
                setTotalLifetimeReferralDiamonds(isNaN(diamondVal) ? 0 : diamondVal);
            }
            await fetchReferralData(currentUser.id, currentUser.telegram_id); // Refresh referrals list and potential claimable
        }
      } else {
        toast({
          title: 'Claim Error',
          description: data.error || 'Could not collect referral rewards. You may have no rewards to claim.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Error collecting rewards:', error.message);
      toast({
        title: 'Server Error',
        description: 'An unexpected error occurred while claiming rewards.',
        variant: 'destructive',
      });
    } finally {
      setClaimLoading(false);
    }
  };
  
  // A simple check to see if user *might* have claimable rewards.
  // A more accurate check would involve the backend /referrals/details or a dedicated API.
  const hasPotentiallyClaimableRewards = referrals.some(r => 
    (Number(r.earningsFrom || 0) > Number(r.last_rewarded_gold || 0)) ||
    (Number(r.earningsFromDiamonds || 0) > Number(r.last_rewarded_diamond || 0)) 
    // This logic is indicative, backend should confirm actual claimable amounts
  );


  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Share2 className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-foreground mb-2">Referral Program</h1>
          <p className="text-lg text-muted-foreground">
            Invite friends to HustleSoul. You get a bonus when they join, and earn a percentage of their future activity!
          </p>
        </div>

        <Card className="mb-8 shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
              <Gift className="h-6 w-6" /> Your Referral Link
            </CardTitle>
            <CardDescription>Share this link with your friends. Your Telegram ID is your code.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center space-x-2">
            <Input type="text" value={referralCode} readOnly className="text-sm sm:text-lg font-mono" />
            <Button onClick={handleCopyCode} variant="outline" size="icon" aria-label="Copy referral code">
              <Copy className="h-5 w-5" />
            </Button>
          </CardContent>
           <CardFooter>
             <a 
                href={`https://t.me/share/url?url=${encodeURIComponent(referralCode)}&text=${encodeURIComponent("Join HustleSoul and earn rewards!")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
            >
                <Button className="w-full" size="lg" disabled={!referralCode}>
                    <Share2 className="mr-2 h-5 w-5" /> Share on Telegram
                </Button>
            </a>
          </CardFooter>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Friends Referred</CardTitle>
              <Users className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="font-headline text-3xl font-bold text-foreground">{referrals.length}</div>
              <p className="text-xs text-muted-foreground">friends joined through you</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lifetime Referral Earnings</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="font-headline text-2xl font-bold text-foreground flex items-center gap-1">
                <Coins className="h-6 w-6 text-yellow-400"/> {totalLifetimeReferralGold.toFixed(2)}
              </div>
              <div className="font-headline text-2xl font-bold text-foreground flex items-center gap-1 mt-1">
                <Gem className="h-6 w-6 text-sky-400"/> {totalLifetimeReferralDiamonds.toFixed(4)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">total earned from referrals</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Claim Rewards Button - shows if there's potentially something to claim or just as a general "check" button */}
        <div className="mb-8">
          <Card className="bg-primary/10 border-primary/50">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Claim Referral Activity Rewards</CardTitle>
              <CardDescription className="text-primary/80">
                Collect rewards based on your referred friends' activity. (5% of their earnings)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={handleCollectRewards}
                disabled={claimLoading}
                variant="default"
              >
                {claimLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Checking & Collecting...
                  </>
                ) : (
                  'Collect Activity Rewards'
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Note: This claims a percentage of your referrals' earnings since your last collection.
              </p>
            </CardContent>
          </Card>
        </div>


        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground">Referred Users List</CardTitle>
            <CardDescription>Users who joined using your referral link.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-4">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : referrals.length > 0 ? (
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {referrals.map((userRef, index) => (
                  <li
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      userRef.status === 'active' ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/30 border-border' 
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-foreground">{userRef.username || userRef.name || `User ${userRef.referred_id?.slice(-4)}`}</p>
                      <p className="text-xs text-muted-foreground">Joined: {new Date(userRef.joined || userRef.created_at).toLocaleDateString()}</p>
                    </div>
                    {/* Displaying referred user's current points, not direct earnings for referrer here */}
                    <div className="text-right">
                        <span className="text-xs font-medium text-yellow-400 flex items-center justify-end gap-1">
                           <Coins className="h-3 w-3"/> {(Number(userRef.earningsFrom) || 0).toLocaleString()}
                        </span>
                        {userRef.earningsFromDiamonds !== undefined && (
                             <span className="text-xs font-medium text-sky-400 flex items-center justify-end gap-1">
                                <Gem className="h-3 w-3"/> {(Number(userRef.earningsFromDiamonds) || 0).toFixed(3)}
                            </span>
                        )}
                        <p className="text-xs text-muted-foreground">{userRef.status === 'active' ? 'Active' : 'Inactive'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">No referrals yet. Start sharing your link!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
