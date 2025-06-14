
'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
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
import { Coins, Gem, Gift, Loader2, Tv, Users, AlertTriangle, RefreshCw, Play } from 'lucide-react';
import type { WheelPrize as BackendPrizeConfig } from '@/types';
import Image from 'next/image';
import ReactWheel from '@/components/wheel/ReactWheel';
import { useUser } from '@/contexts/UserContext';

const AD_SIMULATION_DURATION_SECONDS = 5;

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
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession, fetchUserData: fetchUserFromContext } = useUser();

  const [isBackendProcessing, setIsBackendProcessing] = useState(false);
  const [isWheelSpinningVisually, setIsWheelSpinningVisually] = useState(false);
  const [targetPrizeIndexForWheel, setTargetPrizeIndexForWheel] = useState<number | null>(null);
  const lastWonPrizeRef = useRef<{ label: string; type: 'gold'|'diamonds'; value?: number; icon: React.ElementType} | null>(null);

  const [isAdSimulationOpen, setIsAdSimulationOpen] = useState(false);
  const [adSimulationCountdown, setAdSimulationCountdown] = useState(AD_SIMULATION_DURATION_SECONDS);
  const [shouldSpinAfterAd, setShouldSpinAfterAd] = useState(false);

  const { toast } = useToast();

  const syncUser = useCallback(async () => {
    await fetchUserFromContext(true);
  }, [fetchUserFromContext]);

  const handleSpinAPI = useCallback(async () => {
    if (!currentUser || contextLoadingUser || isBackendProcessing || isWheelSpinningVisually) {
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
        if (data.goldPoints !== undefined && data.diamondPoints !== undefined && data.spinsLeft !== undefined) {
            updateUserSession({
                gold_points: data.goldPoints,
                diamond_points: data.diamondPoints,
                bonus_spins_available: data.spinsLeft,
                initial_free_spin_used: initialFreeSpinIsActuallyAvailable ? true : currentUser.initial_free_spin_used,
            });
        } else {
            await syncUser();
        }
        setIsWheelSpinningVisually(true);
        setTargetPrizeIndexForWheel(data.prizeIndex);
      } else {
        await syncUser();
        setIsWheelSpinningVisually(false);
        setIsBackendProcessing(false);
        throw new Error(data.error || 'Failed to spin the wheel. Server did not return a valid prize index.');
      }
    } catch (error) {
      console.error('Wheel spin API error:', error);
      toast({ title: 'Spin Error', description: (error as Error).message || 'Could not complete spin.', variant: 'destructive' });
      setIsBackendProcessing(false);
      setIsWheelSpinningVisually(false);
      await syncUser();
    }
  }, [currentUser, contextLoadingUser, isBackendProcessing, isWheelSpinningVisually, toast, syncUser, updateUserSession]);

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
  }, [toast]);

  const handleAdWatchedAndReward = useCallback(async () => {
    if (!currentUser || contextLoadingUser) return;
    try {
      setIsBackendProcessing(true);
      const response = await fetch('/api/ads/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast({ title: 'Spin Earned!', description: 'You got a free spin for watching the ad!', icon: <Gift className="text-primary" /> });
        if (data.spinsAvailable !== undefined && data.adsWatchedToday !== undefined) {
            updateUserSession({
                bonus_spins_available: data.spinsAvailable,
                ad_spins_used_today_count: data.adsWatchedToday,
            });
        } else {
             await syncUser();
        }
        setShouldSpinAfterAd(true);
      } else {
        toast({ title: 'Ad Reward Error', description: data.error || 'Could not grant spin.', variant: 'destructive' });
        await syncUser();
      }
    } catch (error) {
      console.error('Error rewarding ad spin:', error);
      toast({ title: 'Server Error', description: (error as Error).message || 'Failed to process ad reward.', variant: 'destructive' });
      await syncUser();
    } finally {
      setIsBackendProcessing(false);
    }
  }, [currentUser, contextLoadingUser, toast, syncUser, updateUserSession]);

  useEffect(() => {
    let adTimer: NodeJS.Timeout;
    if (isAdSimulationOpen && adSimulationCountdown > 0) {
      adTimer = setInterval(() => {
        setAdSimulationCountdown(prev => prev - 1);
      }, 1000);
    } else if (isAdSimulationOpen && adSimulationCountdown === 0) {
      setIsAdSimulationOpen(false);
      setAdSimulationCountdown(AD_SIMULATION_DURATION_SECONDS);
      handleAdWatchedAndReward(); // This is now defined before being used
    }
    return () => clearInterval(adTimer);
  }, [isAdSimulationOpen, adSimulationCountdown, handleAdWatchedAndReward]);


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
  }, [shouldSpinAfterAd, currentUser, isBackendProcessing, isWheelSpinningVisually, handleSpinAPI]);

  const handleWatchAdButtonClick = () => {
    if (!currentUser || contextLoadingUser || isBackendProcessing || isWheelSpinningVisually) return;

    const adsWatched = currentUser.ad_spins_used_today_count || 0;
    const dailyLimit = currentUser.daily_ad_views_limit || 3;

    if (adsWatched >= dailyLimit) {
      toast({ title: 'Ad Limit Reached', description: `You've watched the maximum ads for today (${adsWatched}/${dailyLimit}).`, variant: 'default' });
      return;
    }
    setIsAdSimulationOpen(true);
    setAdSimulationCountdown(AD_SIMULATION_DURATION_SECONDS);
  };

  if (contextLoadingUser && !currentUser) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height))]">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!currentUser && !contextLoadingUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height))] text-center p-4">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-semibold mb-2">User Not Found</h2>
          <p className="text-muted-foreground mb-4">Could not load your profile. Please try refreshing or ensure you are logged in.</p>
          <Button onClick={() => syncUser()}><RefreshCw className="mr-2 h-4 w-4" /> Try Again</Button>
        </div>
      </AppShell>
    );
  }

  const initialFreeSpinIsAvailableForDisplay = !currentUser.initial_free_spin_used;
  const spinsAvailableForDisplay = (initialFreeSpinIsAvailableForDisplay ? 1 : 0) + (currentUser.bonus_spins_available || 0);
  const adsWatchedToday = currentUser.ad_spins_used_today_count || 0;
  const dailyAdViewLimit = currentUser.daily_ad_views_limit || 3;

  return (
    <AppShell>
      <div className="container mx-auto py-4 px-2 sm:px-4 flex flex-col items-center min-h-[calc(100vh-var(--header-height,64px)-var(--bottom-nav-height,64px))] bg-gradient-to-br from-background to-slate-900/50">
        <Card className="w-full max-w-lg shadow-2xl border-2 border-primary/40 overflow-hidden bg-card/95 backdrop-blur-md text-card-foreground">
          <CardHeader className="text-center bg-muted/30 p-3 border-b border-primary/20">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-primary flex items-center justify-center gap-2">
              <Gift className="h-8 w-8 sm:h-9 sm:w-9" /> Wheel of Fortune
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Spin for Gold & Diamonds! Good luck, {currentUser.first_name || 'Player'}!
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 pb-4 px-2 sm:px-4 space-y-4 flex flex-col items-center">
            <ReactWheel
              fixedWheelSize={380}
              segmentsConfig={BACKEND_WHEEL_PRIZES_CONFIG_FOR_PAGE}
              targetPrizeIndex={targetPrizeIndexForWheel}
              isWheelSpinningVisually={isWheelSpinningVisually}
              onSpinAnimationEnd={handleSpinAnimationEnd}
              onWheelClick={handleSpinAPI}
            />

            <div className="text-center space-y-1 mt-4 w-full">
              {lastWonPrizeRef.current && !isWheelSpinningVisually && (
                  <div className="p-2 bg-primary/10 rounded-lg my-2 text-center border border-primary/30 max-w-xs mx-auto">
                      <p className="text-xs text-muted-foreground">Last Won:</p>
                      <p className="text-base font-semibold text-primary flex items-center justify-center gap-1.5">
                          <lastWonPrizeRef.current.icon className={`h-4 w-4 ${lastWonPrizeRef.current.type === 'gold' ? 'text-yellow-500' : 'text-sky-500'}`} />
                          {lastWonPrizeRef.current.label}
                      </p>
                  </div>
              )}
              <p className="text-lg font-semibold">
                Spins Available: <span className="text-primary text-xl font-bold">{spinsAvailableForDisplay}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {initialFreeSpinIsAvailableForDisplay ? "Your first spin is FREE!" :
                 (currentUser.bonus_spins_available || 0) > 0 ? `You have ${currentUser.bonus_spins_available} bonus spin(s).` :
                 "No bonus spins currently."}
              </p>
               <p className="text-xs text-muted-foreground">
                Ads Watched Today: {adsWatchedToday} / {dailyAdViewLimit}
              </p>
            </div>
          </CardContent>
           <CardFooter className="bg-muted/30 p-3 sm:p-4 flex flex-col items-center gap-2 border-t border-primary/20">
             <Button
              onClick={handleSpinAPI}
              variant="default"
              className="w-full max-w-xs bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 py-2.5 text-md sm:text-lg rounded-lg shadow-lg transform hover:scale-105 transition-transform"
              disabled={contextLoadingUser || isBackendProcessing || isWheelSpinningVisually || spinsAvailableForDisplay <= 0}
            >
              {isBackendProcessing || isWheelSpinningVisually ? (
                  <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
              ) : (
                  <Play className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              )}
              {isWheelSpinningVisually ? 'Spinning...' : isBackendProcessing ? 'Starting...' : 'Spin Now!'}
            </Button>

            <Button
              onClick={handleWatchAdButtonClick}
              variant="outline"
              className="w-full max-w-xs border-yellow-500/80 text-yellow-500 hover:bg-yellow-500/10 py-2.5 text-sm sm:text-base"
              disabled={contextLoadingUser || isBackendProcessing || isWheelSpinningVisually || adsWatchedToday >= dailyAdViewLimit}
            >
                <Tv className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Watch Ad for Spin ({dailyAdViewLimit - adsWatchedToday} left)
            </Button>

            <Link href="/referrals" passHref className="w-full max-w-xs">
              <Button variant="secondary" className="w-full py-2.5 text-sm sm:text-base" disabled={!currentUser?.referral_link}>
                <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Invite Friends & Earn More
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
            <div className="py-4 text-center space-y-2">
               <Image
                  src="https://placehold.co/300x150/1f2937/4b5563.png?text=Ad+Playing..."
                  alt="Simulated Ad" width={300} height={150} data-ai-hint="advertisement video player"
                  className="mx-auto rounded-md shadow-lg border"
                />
              <p className="text-3xl sm:text-4xl font-bold text-primary">{adSimulationCountdown}s</p>
            </div>
            <AdDialogFooter>
              <Button onClick={() => {setIsAdSimulationOpen(false); setAdSimulationCountdown(AD_SIMULATION_DURATION_SECONDS); toast({title: "Ad Skipped", description:"No spin awarded.", variant:"destructive"}); setIsBackendProcessing(false);}} variant="outline" className="w-full" disabled={adSimulationCountdown === 0}>
                  Skip Ad
              </Button>
            </AdDialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

    