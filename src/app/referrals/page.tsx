
'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Users, Gift, Share2, Coins, Gem, Loader2, BarChartBig, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/contexts/UserContext';
import type { AppUser } from '@/app/types';

interface ReferredUserSummary {
  id: string;
  referred_id?: string;
  name: string;
  username: string;
  joined: string;
  status: string;
  earningsFrom: number; // Represents referred_user_gold_points at time of fetch
  earningsFromDiamonds?: number; // Represents referred_user_diamond_points at time of fetch
  last_rewarded_gold: number;
  last_rewarded_diamond: number;
  // This 'users' sub-object comes directly from Supabase join if you use 'users:referrals_referred_id_fkey(...)'
  users?: {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    gold_points?: number;    // Current gold_points of the referred user
    diamond_points?: number; // Current diamond_points of the referred user
    created_at?: string;
  }
}

export default function ReferralsPage() {
  const { toast } = useToast();
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();

  const [referralCode, setReferralCode] = useState<string>('');
  const [referrals, setReferrals] = useState<ReferredUserSummary[]>([]);
  const [isFetchingReferralDetails, setIsFetchingReferralDetails] = useState<boolean>(true);
  const [claimLoading, setClaimLoading] = useState<boolean>(false);

  const [pendingClaimableGold, setPendingClaimableGold] = useState<number>(0);
  const [pendingClaimableDiamonds, setPendingClaimableDiamonds] = useState<number>(0);

  const totalLifetimeReferralGold = Number(currentUser?.referral_gold_earned || 0);
  const totalLifetimeReferralDiamonds = Number(currentUser?.referral_diamond_earned || 0);

  const calculateClaimableRewards = useCallback((referralList: ReferredUserSummary[]) => {
    let goldToClaim = 0;
    let diamondsToClaim = 0;

    referralList.forEach(ref => {
      // Prioritize the 'users' sub-object for current points as it's likely more up-to-date from the join
      const referredUserCurrentGold = Number(ref.users?.gold_points ?? ref.earningsFrom ?? 0);
      const referredUserCurrentDiamonds = Number(ref.users?.diamond_points ?? ref.earningsFromDiamonds ?? 0);
      
      const lastRewardedGoldForThisRef = Number(ref.last_rewarded_gold || 0);
      const lastRewardedDiamondsForThisRef = Number(ref.last_rewarded_diamond || 0);

      const goldDiff = Math.max(0, referredUserCurrentGold - lastRewardedGoldForThisRef);
      const diamondDiff = Math.max(0, referredUserCurrentDiamonds - lastRewardedDiamondsForThisRef);

      goldToClaim += goldDiff * 0.05; // 5% commission
      diamondsToClaim += diamondDiff * 0.05; // 5% commission
    });

    setPendingClaimableGold(parseFloat(goldToClaim.toFixed(2)));
    setPendingClaimableDiamonds(parseFloat(diamondsToClaim.toFixed(4)));
  }, []);


  const fetchReferralDetailsAndCalculate = useCallback(async (userId: string, userTelegramId: string) => {
    setIsFetchingReferralDetails(true);
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
      const fetchedReferrals: ReferredUserSummary[] = referralsData.referrals || [];
      setReferrals(fetchedReferrals);
      calculateClaimableRewards(fetchedReferrals);

    } catch (error: any) {
      console.error('Error fetching referral details:', error.message);
      toast({ title: 'Error Loading Referrals', description: error.message, variant: 'destructive' });
      setReferrals([]);
      setPendingClaimableGold(0);
      setPendingClaimableDiamonds(0);
    } finally {
      setIsFetchingReferralDetails(false);
    }
  }, [toast, calculateClaimableRewards]);

  useEffect(() => {
    if (currentUser?.id && currentUser.telegram_id) {
        fetchReferralDetailsAndCalculate(currentUser.id, currentUser.telegram_id);
    } else if (!contextLoadingUser && !currentUser) {
        setIsFetchingReferralDetails(false);
        toast({ title: "User Not Loaded", description: "Cannot load referral data.", variant: "default" });
    }
  }, [currentUser, contextLoadingUser, fetchReferralDetailsAndCalculate, toast]);


  const handleCopyCode = () => {
    if (referralCode) {
        navigator.clipboard.writeText(referralCode);
        toast({ title: "Copied to Clipboard!", description: "Your referral code has been copied." });
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
        const goldEarned = Number(data.goldEarned || 0);
        const diamondEarned = Number(data.diamondEarned || 0);

        toast({
          title: 'Collected Successfully!',
          description: `You earned ${goldEarned.toFixed(2)} GOLD and ${diamondEarned.toFixed(4)} DIAMOND.`,
        });

        updateUserSession({
            gold_points: data.totalGold, // API returns new total gold
            diamond_points: data.totalDiamonds, // API returns new total diamonds
            referral_gold_earned: (totalLifetimeReferralGold + goldEarned),
            referral_diamond_earned: (totalLifetimeReferralDiamonds + diamondEarned),
        });

        if (currentUser.id && currentUser.telegram_id) {
            await fetchReferralDetailsAndCalculate(currentUser.id, currentUser.telegram_id);
        } else { // Fallback if telegram_id isn't immediately available from context for some reason
            setPendingClaimableGold(0);
            setPendingClaimableDiamonds(0);
        }
      } else {
        toast({ title: 'Claim Error', description: data.error || 'Could not collect referral rewards.', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('Error collecting rewards:', error.message);
      toast({ title: 'Server Error', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setClaimLoading(false);
    }
  };

  const canClaimRewards = pendingClaimableGold > 0 || pendingClaimableDiamonds > 0;

  if (contextLoadingUser && !currentUser) {
    return (
      <AppShell>
        <div className="flex justify-center items-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height))]">
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
          <p className="text-lg text-muted-foreground"> Invite friends to HustleSoul. You get bonuses & earn 5% of their future activity! </p>
        </div>

        <Card className="mb-8 shadow-xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2"> <Gift className="h-6 w-6" /> Your Referral Link </CardTitle>
            <CardDescription>Share this link. Your Telegram ID is your code.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center space-x-2">
            <Input type="text" value={currentUser?.referral_link || referralCode} readOnly className="text-sm sm:text-base font-mono bg-muted/30" />
            <Button onClick={handleCopyCode} variant="outline" size="icon" aria-label="Copy referral code" disabled={!currentUser?.referral_link && !referralCode}> <Copy className="h-5 w-5" /> </Button>
          </CardContent>
           <CardFooter>
             <a  href={`https://t.me/share/url?url=${encodeURIComponent(currentUser?.referral_link || referralCode)}&text=${encodeURIComponent("Join HustleSoul and earn rewards!")}`} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button className="w-full" size="lg" disabled={!currentUser?.referral_link && !referralCode}> <Share2 className="mr-2 h-5 w-5" /> Share on Telegram </Button>
            </a>
          </CardFooter>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Friends Joined</CardTitle>
              <Users className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="font-headline text-3xl font-bold text-foreground">{referrals.length}</div>
              <p className="text-xs text-muted-foreground">active referrals</p>
            </CardContent>
          </Card>
           <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Lifetime Referral Earnings</CardTitle>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent className="space-y-1">
                <div className="font-headline text-xl font-bold text-foreground flex items-center gap-1.5">
                    <Coins className="h-5 w-5 text-yellow-400"/> {totalLifetimeReferralGold.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </div>
                 <div className="font-headline text-xl font-bold text-foreground flex items-center gap-1.5">
                    <Gem className="h-5 w-5 text-sky-400"/> {totalLifetimeReferralDiamonds.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          <Card className="bg-primary/10 border-primary/50 shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Claim Activity Rewards</CardTitle>
              <CardDescription className="text-primary/80"> Collect 5% of referred friends' earnings since last collection. </CardDescription>
            </CardHeader>
            <CardContent>
              {isFetchingReferralDetails && !canClaimRewards ? (
                 <div className="flex justify-center items-center py-3"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ): canClaimRewards ? (
                <div className="mb-3 text-center space-y-1">
                    <p className="text-sm text-foreground">Pending to claim:</p>
                    {pendingClaimableGold > 0 && <span className="font-semibold text-yellow-400 text-lg block"><Coins className="inline h-5 w-5 mr-1"/>{pendingClaimableGold.toFixed(2)} Gold</span>}
                    {pendingClaimableDiamonds > 0 && <span className="font-semibold text-sky-400 text-lg block"><Gem className="inline h-5 w-5 mr-1"/>{pendingClaimableDiamonds.toFixed(4)} Diamonds</span>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center mb-3">No rewards to claim from recent activity.</p>
              )}
              <Button className="w-full" onClick={handleCollectRewards} disabled={claimLoading || !canClaimRewards || isFetchingReferralDetails} variant="default" size="lg">
                {claimLoading ? ( <><Loader2 className="animate-spin mr-2 h-5 w-5" /> Collecting...</> ) : ( 'Collect Now' )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-foreground">Your Referrals</CardTitle>
            <CardDescription>Users who joined via your link.</CardDescription>
          </CardHeader>
          <CardContent>
            {isFetchingReferralDetails ? (
              <div className="flex justify-center items-center py-6"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </div>
            ) : referrals.length > 0 ? (
              <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {referrals.map((userRef) => (
                  <li key={userRef.id || userRef.referred_id}
                    className={`flex items-center justify-between p-3 rounded-md border ${ userRef.status === 'active' ? 'bg-green-500/10 border-green-500/40' : 'bg-muted/40 border-border' }`}>
                    <div>
                      <p className="font-semibold text-foreground">{userRef.users?.username || userRef.users?.first_name || userRef.username || userRef.name || `User ${userRef.referred_id?.slice(-4)}`}</p>
                      <p className="text-xs text-muted-foreground">Joined: {new Date(userRef.users?.created_at || userRef.joined).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-medium text-yellow-400 flex items-center justify-end gap-1"> <Coins className="h-3 w-3"/> {(Number(userRef.users?.gold_points || userRef.earningsFrom || 0)).toLocaleString()} </span>
                        {(Number(userRef.users?.diamond_points || userRef.earningsFromDiamonds || 0)) > 0 && (
                             <span className="text-xs font-medium text-sky-400 flex items-center justify-end gap-1"> <Gem className="h-3 w-3"/> {(Number(userRef.users?.diamond_points || userRef.earningsFromDiamonds || 0)).toFixed(3)} </span>
                        )}
                        <p className={`text-xs font-semibold ${userRef.status === 'active' ? 'text-green-400' : 'text-amber-500'}`}>{userRef.status === 'active' ? 'Active' : 'Inactive'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-6">No referrals yet. Start sharing your link!</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
