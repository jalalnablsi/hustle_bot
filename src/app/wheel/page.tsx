
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter as AdDialogFooter } from "@/components/ui/dialog";
import { Coins, Gem, Gift, Loader2, Tv, Users, AlertTriangle, RefreshCw, History, Sparkles, Play } from 'lucide-react';
import type { User as AppUser, WheelPrize as BackendPrizeConfig } from '@/types';
import Image from 'next/image';
import ReactWheel from '@/components/wheel/ReactWheel'; // Import the new ReactWheel

const AD_SIMULATION_DURATION_SECONDS = 5;

// This configuration MUST EXACTLY MATCH the one in ReactWheel.tsx for display
// and ideally align with backend prize definitions if those are fetched.
const BACKEND_WHEEL_PRIZES_CONFIG_FOR_PAGE: Omit<BackendPrizeConfig, 'id' | 'dataAiHint' | 'color' | 'isSpecial' | 'description' | 'probabilityWeight'>[] = [
  { name: '50 Gold', type: 'gold', value: 50 },
  { name: '2 Diamond', type: 'diamonds', value: 2 },
  { name: '100 Gold', type: 'gold', value: 100 },
  { name: 'Try Again', type: 'gold', value: 0 },
  { name: '25 Gold', type: 'gold', value: 25 },
  { name: '1 Diamond', type: 'diamonds', value: 1 },
  { name: '75 Gold', type: 'gold', value: 75 },
  { name: '3 Diamond', type: 'diamonds', value: 3 },
];


export default function WheelPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  
  const [isBackendProcessing, setIsBackendProcessing] = useState(false);
  const [isWheelSpinningVisually, setIsWheelSpinningVisually] = useState(false);
  const [targetPrizeIndexForWheel, setTargetPrizeIndexForWheel] = useState<number | null>(null);
  const lastWonPrizeRef = useRef<{ label: string; type: 'gold'|'diamonds'; value?: number; icon: React.ElementType} | null>(null);

  const [isAdSimulationOpen, setIsAdSimulationOpen] = useState(false);
  const [adSimulationCountdown, setAdSimulationCountdown] = useState(AD_SIMULATION_DURATION_SECONDS);
  const [shouldSpinAfterAd, setShouldSpinAfterAd] = useState(false);
  
  const { toast } = useToast();

  const fetchUser = useCallback(async (showLoadingToast = false) => {
    if (showLoadingToast) {
      // toast({ title: 'Syncing User Data...', duration: 1500 });
    }
    setIsLoadingUser(true);
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        let errorBodyMessage = `Failed to sync user data (status: ${response.status})`;
        try { const errorData = await response.json(); errorBodyMessage = errorData.error || errorBodyMessage; } catch (e) { /* ignore */ }
        throw new Error(errorBodyMessage);
      }
      const data = await response.json();
      if (data.success && data.user) {
        const validatedUser: AppUser = {
            ...data.user,
            id: data.user.id || `mock-id-${data.user.telegram_id}`, 
            gold_points: Number(data.user.gold_points) || 0,
            diamond_points: Number(data.user.diamond_points) || 0,
            purple_gem_points: Number(data.user.purple_gem_points) || 0,
            blue_gem_points: Number(data.user.blue_gem_points) || 0,
            referrals_made: Number(data.user.referrals_made) || 0,
            initial_free_spin_used: Boolean(data.user.initial_free_spin_used),
            ad_spins_used_today_count: Number(data.user.ad_spins_used_today_count || data.user.ad_views_today_count) || 0, // Use ad_spins_used_today_count if available, else ad_views_today_count
            bonus_spins_available: Number(data.user.bonus_spins_available) || 0,
            daily_ad_views_limit: Number(data.user.daily_ad_views_limit) || 3,
            daily_reward_streak: Number(data.user.daily_reward_streak) || 0,
            last_daily_reward_claim_at: data.user.last_daily_reward_claim_at || null,
       
        };
        setCurrentUser(validatedUser);
        window.dispatchEvent(new CustomEvent<AppUser>('userUpdated_nofreetalk', { detail: validatedUser }));
      } else {
        setCurrentUser(null);
         toast({ title: 'User Data Error', description: data.error || 'Could not process user profile.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching user for wheel:', error);
      setCurrentUser(null);
      // toast({ title: 'Profile Sync Error', description: (error as Error).message || 'Could not load your profile.', variant: 'destructive' });
    } finally {
      setIsLoadingUser(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUser(true);
    const handleGlobalUserUpdate = (event: CustomEvent<AppUser>) => setCurrentUser(event.detail);
    window.addEventListener('userUpdated_nofreetalk', handleGlobalUserUpdate as EventListener);
    return () => window.removeEventListener('userUpdated_nofreetalk', handleGlobalUserUpdate as EventListener);
  }, [fetchUser]);

  const handleSpinAPI = async () => {
    if (!currentUser || isLoadingUser || isBackendProcessing || isWheelSpinningVisually) {
        return;
    }

    const initialFreeSpinIsActuallyAvailable = !currentUser.initial_free_spin_used;
    const currentSpinsAvailableForAPI = (initialFreeSpinIsActuallyAvailable ? 1 : 0) + (currentUser.bonus_spins_available || 0);

    if (currentSpinsAvailableForAPI <= 0) {
      toast({ title: 'No Spins Left', description: 'Watch an ad or invite friends to earn more spins!', variant: 'default' });
      return;
    }

    setIsBackendProcessing(true);
    lastWonPrizeRef.current = null; 
    setTargetPrizeIndexForWheel(null); 
    
    try {
      const response = await fetch('/api/wheel/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await response.json();

      if (response.ok && data.success && typeof data.prizeIndex === 'number') {
        await fetchUser(); 
        setIsWheelSpinningVisually(true); 
        setTargetPrizeIndexForWheel(data.prizeIndex); 
      } else {
        await fetchUser(); 
        setIsWheelSpinningVisually(false);
        setIsBackendProcessing(false);
        throw new Error(data.error || 'Failed to spin the wheel. Server did not return a valid prize index.');
      }
    } catch (error) {
      console.error('Wheel spin API error:', error);
      toast({ title: 'Spin Error', description: (error as Error).message || 'Could not complete spin.', variant: 'destructive' });
      setIsBackendProcessing(false);
      setIsWheelSpinningVisually(false);
      await fetchUser(); 
    }
  };
  
  const handleSpinAnimationEnd = useCallback((wonPrizeData: { label: string; type: 'gold'|'diamonds'; value?: number; icon: React.ElementType}) => {
    setIsWheelSpinningVisually(false);
    setIsBackendProcessing(false); 
    lastWonPrizeRef.current = wonPrizeData;

    toast({
      title: wonPrizeData.value === 0 ? 'Better Luck Next Time!' : 'You Won!',
      description: (
        <span className="flex items-center gap-1.5">
          <wonPrizeData.icon className={`h-5 w-5 ${wonPrizeData.type === 'gold' ? 'text-yellow-400' : 'text-sky-400'}`} />
          {wonPrizeData.label} 
        </span>
      ),
      duration: 4000,
    });
    fetchUser(); 
  }, [fetchUser, toast]);
  
  useEffect(() => {
    let adTimer: NodeJS.Timeout;
    if (isAdSimulationOpen && adSimulationCountdown > 0) {
      adTimer = setInterval(() => {
        setAdSimulationCountdown(prev => prev - 1);
      }, 1000);
    } else if (isAdSimulationOpen && adSimulationCountdown === 0) {
      setIsAdSimulationOpen(false);
      setAdSimulationCountdown(AD_SIMULATION_DURATION_SECONDS);
      handleAdWatchedAndReward();
    }
    return () => clearInterval(adTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdSimulationOpen, adSimulationCountdown]); 

  const handleAdWatchedAndReward = async () => {
    if (!currentUser || isLoadingUser) return;    
    try {
      setIsBackendProcessing(true); 
      const response = await fetch('/api/ads/view', { // This API needs to be created
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Spin Earned!', description: 'You got a free spin for watching the ad!', icon: <Gift className="text-primary" /> });
        await fetchUser(); 
        setShouldSpinAfterAd(true); 
      } else {
        toast({ title: 'Ad Reward Error', description: data.error || 'Could not grant spin.', variant: 'destructive' });
        await fetchUser();
      }
    } catch (error) {
      console.error('Error rewarding ad spin:', error);
      toast({ title: 'Server Error', description: (error as Error).message || 'Failed to process ad reward.', variant: 'destructive' });
      await fetchUser();
    } finally {
      setIsBackendProcessing(false); 
    }
  };

  useEffect(() => {
    if (shouldSpinAfterAd && currentUser && !isBackendProcessing && !isWheelSpinningVisually) {
      const initialFreeSpinIsActuallyAvailableAfterAd = !currentUser.initial_free_spin_used;
      const currentSpinsAfterAd = (initialFreeSpinIsActuallyAvailableAfterAd ? 1 : 0) + (currentUser.bonus_spins_available || 0);
      if (currentSpinsAfterAd > 0) {
        setTimeout(() => { 
             handleSpinAPI();
        }, 200);
      }
      setShouldSpinAfterAd(false); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSpinAfterAd, currentUser, isBackendProcessing, isWheelSpinningVisually]); 

  const handleWatchAdButtonClick = () => {
    if (!currentUser || isLoadingUser || isBackendProcessing || isWheelSpinningVisually) return;
    
    const adsWatched = currentUser.ad_spins_used_today_count || 0;
    const dailyLimit = currentUser.daily_ad_views_limit || 3; 

    if (adsWatched >= dailyLimit) {
      toast({ title: 'Ad Limit Reached', description: `You've watched the maximum ads for today (${adsWatched}/${dailyLimit}).`, variant: 'default' });
      return;
    }
    setIsAdSimulationOpen(true);
    setAdSimulationCountdown(AD_SIMULATION_DURATION_SECONDS);
  };

  if (isLoadingUser && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser && !isLoadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">User Not Found</h2>
        <p className="text-muted-foreground mb-4">Could not load your profile. Please try refreshing or ensure you are logged in. Test login might be in progress.</p>
        <Button onClick={() => fetchUser(true)}><RefreshCw className="mr-2 h-4 w-4" /> Try Again</Button>
      </div>
    );
  }
  
  const initialFreeSpinIsAvailableForDisplay = !currentUser.initial_free_spin_used;
  const spinsAvailableForDisplay = (initialFreeSpinIsAvailableForDisplay ? 1 : 0) + (currentUser.bonus_spins_available || 0);
  const adsWatchedToday = currentUser.ad_spins_used_today_count || 0;
  const dailyAdViewLimit = currentUser.daily_ad_views_limit || 3;

  return (
    <div className="container mx-auto py-6 px-2 sm:px-4 flex flex-col items-center min-h-screen bg-gradient-to-br from-background to-slate-900/50">
      <Card className="w-full max-w-2xl shadow-2xl border-2 border-primary/40 overflow-hidden bg-card/95 backdrop-blur-md text-card-foreground">
        <CardHeader className="text-center bg-muted/30 p-4 border-b border-primary/20">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center gap-2.5">
            <Gift className="h-9 w-9" /> Wheel of Fortune
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1 text-sm">
            Spin for Gold & Diamonds! Good luck, {currentUser.first_name || 'Player'}!
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 pb-8 px-2 sm:px-4 space-y-6 flex flex-col items-center">
          {/* ReactWheel component will be rendered here. Ensure src/components/wheel/ReactWheel.tsx exists. */}
          {typeof ReactWheel !== 'undefined' ? (
            <ReactWheel
              fixedWheelSize={460} 
              segmentsConfig={BACKEND_WHEEL_PRIZES_CONFIG_FOR_PAGE}
              targetPrizeIndex={targetPrizeIndexForWheel}
              isWheelSpinningVisually={isWheelSpinningVisually}
              onSpinAnimationEnd={handleSpinAnimationEnd}
              onWheelClick={handleSpinAPI} 
            />
          ) : (
            <div className="h-[460px] w-[460px] flex items-center justify-center bg-muted rounded-full">
              <p className="text-muted-foreground">Wheel component loading or missing...</p>
            </div>
          )}
          
          <div className="text-center space-y-2 mt-6 w-full">
            {lastWonPrizeRef.current && !isWheelSpinningVisually && (
                <div className="p-3 bg-primary/10 rounded-lg my-3 text-center border border-primary/30 max-w-xs mx-auto">
                    <p className="text-sm text-muted-foreground">Last Won:</p>
                    <p className="text-lg font-semibold text-primary flex items-center justify-center gap-1.5">
                        <lastWonPrizeRef.current.icon className={`h-5 w-5 ${lastWonPrizeRef.current.type === 'gold' ? 'text-yellow-500' : 'text-sky-500'}`} />
                        {lastWonPrizeRef.current.label}
                    </p>
                </div>
            )}
            <p className="text-xl font-semibold">
              Spins Available: <span className="text-primary text-2xl font-bold">{spinsAvailableForDisplay}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {initialFreeSpinIsAvailableForDisplay ? "Your first spin is FREE!" : 
               (currentUser.bonus_spins_available || 0) > 0 ? `You have ${currentUser.bonus_spins_available} bonus spin(s).` : 
               "No bonus spins currently."}
            </p>
             <p className="text-xs text-muted-foreground">
              Ads Watched Today for Spins: {adsWatchedToday} / {dailyAdViewLimit}
            </p>
          </div>
        </CardContent>
         <CardFooter className="bg-muted/30 p-4 flex flex-col items-center gap-3 border-t border-primary/20">
           <Button
            onClick={handleSpinAPI} 
            variant="default"
            className="w-full max-w-xs bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 py-3 text-lg rounded-lg shadow-lg transform hover:scale-105 transition-transform"
            disabled={isLoadingUser || isBackendProcessing || isWheelSpinningVisually || spinsAvailableForDisplay <= 0}
          >
            {isBackendProcessing || isWheelSpinningVisually ? (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
                <Play className="mr-2 h-6 w-6" />
            )}
            {isWheelSpinningVisually ? 'Spinning...' : isBackendProcessing ? 'Starting...' : 'Spin Now!'}
          </Button>

          <Button
            onClick={handleWatchAdButtonClick}
            variant="outline"
            className="w-full max-w-xs border-yellow-500/80 text-yellow-500 hover:bg-yellow-500/10 py-3 text-base"
            disabled={isLoadingUser || isBackendProcessing || isWheelSpinningVisually || adsWatchedToday >= dailyAdViewLimit}
          >
              <Tv className="mr-2 h-5 w-5" /> Watch Ad for Spin ({dailyAdViewLimit - adsWatchedToday} left)
          </Button>
          
          <Link href="/referrals" passHref className="w-full max-w-xs">
            <Button variant="secondary" className="w-full py-3 text-base" disabled={!currentUser || !currentUser.referral_link}>
              <Users className="mr-2 h-5 w-5" /> Invite Friends & Earn More
            </Button>
          </Link>
          
           <Link href="/" passHref className="mt-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary">
              <History className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </CardFooter>
      </Card>

      <Dialog open={isAdSimulationOpen} onOpenChange={(open) => { if (!open && adSimulationCountdown > 0) {setIsAdSimulationOpen(false); setAdSimulationCountdown(AD_SIMULATION_DURATION_SECONDS); setIsBackendProcessing(false); }}} >
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tv className="text-primary"/> Simulated Ad</DialogTitle>
            <DialogDescription>
              Please wait for the ad to finish to earn your spin.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center space-y-3">
             <Image 
                src="https://placehold.co/300x150.png?text=Ad+Playing..." 
                alt="Simulated Ad" width={300} height={150} data-ai-hint="advertisement video player"
                className="mx-auto rounded-md shadow-lg border"
              />
            <p className="text-4xl font-bold text-primary">{adSimulationCountdown}s</p>
          </div>
          <AdDialogFooter>
            <Button onClick={() => {setIsAdSimulationOpen(false); setAdSimulationCountdown(AD_SIMULATION_DURATION_SECONDS); toast({title: "Ad Skipped", description:"No spin awarded.", variant:"destructive"}); setIsBackendProcessing(false);}} variant="outline" className="w-full" disabled={adSimulationCountdown === 0}>
                Skip Ad
            </Button>
          </AdDialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
