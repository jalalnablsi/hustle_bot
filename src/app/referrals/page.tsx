
'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Users, Gift, TrendingUp, Share2, Coins, Gem, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AppUser } from '@/app/types';

interface ReferredUserSummary {
  id: string;
  referred_id?: string;
  name: string;
  username: string;
  joined: string;
  status: string;
  // earningsFrom seems to be the referred user's total gold
  earningsFrom: number; 
  // Need to clarify if API sends earningsFromDiamonds or if we derive from users.diamond_points
  earningsFromDiamonds?: number; 
  last_rewarded_gold: number;
  last_rewarded_diamond: number;
  users?: { // Nested user object from the API
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    gold_points?: number;
    diamond_points?: number;
    created_at?: string;
  }
}


export default function ReferralsPage() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referrals, setReferrals] = useState<ReferredUserSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimLoading, setClaimLoading] = useState<boolean>(false);
  
  const [pendingClaimableGold, setPendingClaimableGold] = useState<number>(0);
  const [pendingClaimableDiamonds, setPendingClaimableDiamonds] = useState<number>(0);

  const [totalLifetimeReferralGold, setTotalLifetimeReferralGold] = useState<number>(0);
  const [totalLifetimeReferralDiamonds, setTotalLifetimeReferralDiamonds] = useState<number>(0);

  const calculateClaimableRewards = useCallback((referralList: ReferredUserSummary[]) => {
    let goldToClaim = 0;
    let diamondsToClaim = 0;

    referralList.forEach(ref => {
      const referredUserCurrentGold = Number(ref.users?.gold_points || ref.earningsFrom || 0);
      const referredUserCurrentDiamonds = Number(ref.users?.diamond_points || ref.earningsFromDiamonds || 0);
      const lastRewardedGoldForThisRef = Number(ref.last_rewarded_gold || 0);
      const lastRewardedDiamondsForThisRef = Number(ref.last_rewarded_diamond || 0);

      const goldDiff = Math.max(0, referredUserCurrentGold - lastRewardedGoldForThisRef);
      const diamondDiff = Math.max(0, referredUserCurrentDiamonds - lastRewardedDiamondsForThisRef);

      goldToClaim += goldDiff * 0.05;
      diamondsToClaim += diamondDiff * 0.05;
    });
    
    setPendingClaimableGold(parseFloat(goldToClaim.toFixed(2))); // Max 2 decimal for gold
    setPendingClaimableDiamonds(parseFloat(diamondsToClaim.toFixed(4))); // Max 4 for diamonds
  }, []);


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
      const fetchedReferrals = referralsData.referrals || [];
      setReferrals(fetchedReferrals);
      calculateClaimableRewards(fetchedReferrals);

    } catch (error: any) {
      console.error('Error fetching referral details:', error.message);
      toast({
        title: 'Error Loading Referrals',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast, calculateClaimableRewards]);

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
        const diamondVal = parseFloat(user.referral_diamond_earned as any); // referral_diamond_earned might be string from DB
        setTotalLifetimeReferralDiamonds(isNaN(diamondVal) ? 0 : diamondVal);
        
        if (user.id && user.telegram_id) {
            await fetchReferralData(user.id, user.telegram_id);
        }

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
     // Listen to global user updates
    const handleUserUpdate = (event: CustomEvent<AppUser>) => {
        const updatedUser = event.detail;
        setCurrentUser(updatedUser);
         setTotalLifetimeReferralGold(Number(updatedUser.referral_gold_earned) || 0);
        const diamondVal = parseFloat(updatedUser.referral_diamond_earned as any);
        setTotalLifetimeReferralDiamonds(isNaN(diamondVal) ? 0 : diamondVal);
    };
    window.addEventListener('userUpdated_hustlesoul', handleUserUpdate as EventListener);

    return () => {
        window.removeEventListener('userUpdated_hustlesoul', handleUserUpdate as EventListener);
    };
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
    if (pendingClaimableGold <= 0 && pendingClaimableDiamonds <= 0) {
        toast({ title: 'No Rewards', description: 'You have no referral rewards to claim at the moment.', variant: 'default'});
        return;
    }

    setClaimLoading(true);
    try {
      const res = await fetch('/api/referrals/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referrer_id: currentUser.id }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Collected Successfully!',
          description: `You earned ${Number(data.goldEarned || 0).toFixed(2)} GOLD and ${Number(data.diamondEarned || 0).toFixed(4)} DIAMOND.`,
        });
        
        // Update current user's total balances and lifetime referral earnings
        setCurrentUser(prevUser => {
            if (!prevUser) return null;
            const newGold = (Number(prevUser.gold_points) || 0) + (Number(data.goldEarned) || 0);
            const newDiamonds = (Number(prevUser.diamond_points) || 0) + (Number(data.diamondEarned) || 0);
            const newRefGold = (Number(prevUser.referral_gold_earned) || 0) + (Number(data.goldEarned) || 0);
            const newRefDiamonds = (Number(prevUser.referral_diamond_earned) || 0) + (Number(data.diamondEarned) || 0);

            const updatedUser = {
                ...prevUser,
                gold_points: newGold,
                diamond_points: newDiamonds,
                referral_gold_earned: newRefGold,
                referral_diamond_earned: newRefDiamonds
            };
            // Dispatch event for other components like Header to update
            window.dispatchEvent(new CustomEvent<AppUser>('userUpdated_hustlesoul', { detail: updatedUser }));
            return updatedUser;
        });
        
        // Refresh referral list details to update last_rewarded_gold/diamond and recalculate pending
        if (currentUser.id && currentUser.telegram_id) {
            await fetchReferralData(currentUser.id, currentUser.telegram_id); 
        }

      } else {
        toast({
          title: 'Claim Error',
          description: data.error || 'Could not collect referral rewards.',
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
  
  const canClaimRewards = pendingClaimableGold > 0 || pendingClaimableDiamonds > 0;

  if (loading && !currentUser) {
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
            Invite friends to HustleSoul. You get a bonus when they join, and earn 5% of their future activity!
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
              <p className="text-xs text-muted-foreground mt-1">total earned from referrals' activity</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="mb-8">
          <Card className="bg-primary/10 border-primary/50">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Claim Referral Activity Rewards</CardTitle>
              <CardDescription className="text-primary/80">
                Collect 5% of your referred friends' earnings since your last collection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canClaimRewards ? (
                <div className="mb-3 text-center">
                    <p className="text-sm text-foreground">You can claim:</p>
                    {pendingClaimableGold > 0 && <span className="font-semibold text-yellow-400 text-lg block"><Coins className="inline h-5 w-5 mr-1"/>{pendingClaimableGold.toFixed(2)} Gold</span>}
                    {pendingClaimableDiamonds > 0 && <span className="font-semibold text-sky-400 text-lg block"><Gem className="inline h-5 w-5 mr-1"/>{pendingClaimableDiamonds.toFixed(4)} Diamonds</span>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center mb-3">No rewards to claim at the moment.</p>
              )}
              <Button
                className="w-full"
                onClick={handleCollectRewards}
                disabled={claimLoading || !canClaimRewards}
                variant="default"
              >
                {claimLoading ? (
                  <> <Loader2 className="animate-spin mr-2 h-5 w-5" /> Collecting... </>
                ) : (
                  'Collect Rewards'
                )}
              </Button>
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
                {referrals.map((userRef) => (
                  <li
                    key={userRef.id || userRef.referred_id}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      userRef.status === 'active' ? 'bg-green-500/5 border-green-500/30' : 'bg-muted/30 border-border' 
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-foreground">{userRef.users?.username || userRef.users?.first_name || userRef.username || userRef.name || `User ${userRef.referred_id?.slice(-4)}`}</p>
                      <p className="text-xs text-muted-foreground">Joined: {new Date(userRef.users?.created_at || userRef.joined).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-medium text-yellow-400 flex items-center justify-end gap-1">
                           <Coins className="h-3 w-3"/> {(Number(userRef.users?.gold_points || userRef.earningsFrom || 0)).toLocaleString()}
                        </span>
                        {(Number(userRef.users?.diamond_points || userRef.earningsFromDiamonds || 0)) > 0 && (
                             <span className="text-xs font-medium text-sky-400 flex items-center justify-end gap-1">
                                <Gem className="h-3 w-3"/> {(Number(userRef.users?.diamond_points || userRef.earningsFromDiamonds || 0)).toFixed(3)}
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
