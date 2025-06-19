
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
import { Coins, Gem, Gift, Loader2, Tv, Users, AlertTriangle, RefreshCw, Play } from 'lucide-react';
import type { WheelPrize as BackendPrizeConfig } from '@/types';
import ReactWheel from '@/components/wheel/ReactWheel';
import { useUser } from '@/contexts/UserContext';
import { useAdsgram } from '@/hooks/useAdsgram'; 

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

const ADSGRAM_WHEEL_BLOCK_ID = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_WHEEL || 'default-wheel-block-id';


export default function WheelPage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession, fetchUserData, telegramAuthError } = useUser();

  const [isBackendProcessing, setIsBackendProcessing] = useState(false); 
  const [isWheelSpinningVisually, setIsWheelSpinningVisually] = useState(false);
  const [targetPrizeIndexForWheel, setTargetPrizeIndexForWheel] = useState<number | null>(null);
  const lastWonPrizeRef = useRef<{ label: string; type: 'gold'|'diamonds'; value?: number; icon: React.ElementType} | null>(null);
  
  const [isAdInProgress, setIsAdInProgress] = useState(false); 

  const { toast } = useToast();

  const handleAdsgramRewardClientSide = useCallback(() => {
    toast({ title: 'Ad Watched!', description: 'Spin reward is being processed. Refreshing your data...', icon: <Gift className="text-primary" /> });
    setTimeout(() => { 
        fetchUserData(); 
    }, 2500); 
    setIsAdInProgress(false);
  }, [toast, fetchUserData]);

  const handleAdsgramErrorClientSide = useCallback(() => {
    setIsAdInProgress(false);
  }, []);
  
  const handleAdsgramCloseClientSide = useCallback(() => {
    if (!isAdInProgress) return; // Only act if an ad was indeed in progress
    // Check if a reward was triggered; if so, onReward handles setIsAdInProgress(false)
    // This ensures if user closes ad early, we reset the state.
    // A more robust way might involve a flag set by onReward.
    // For now, this basic close handling should be okay.
    setIsAdInProgress(false);
  }, [isAdInProgress]);

  const showAdsgramAdForSpin = useAdsgram({
    blockId: ADSGRAM_WHEEL_BLOCK_ID,
    onReward: handleAdsgramRewardClientSide,
    onError: handleAdsgramErrorClientSide,
    onClose: handleAdsgramCloseClientSide,
  });

  const handleSpinAPI = useCallback(async () => {
    if (!currentUser || contextLoadingUser || isBackendProcessing || isWheelSpinningVisually || isAdInProgress) {
        return;
    }

    const initialFreeSpinIsActuallyAvailable = !currentUser.initial_free_spin_used;
    const currentBonusSpins = currentUser.bonus_spins_available || 0;
    const totalSpinsAvailableForAPI = (initialFreeSpinIsActuallyAvailable ? 1 : 0) + currentBonusSpins;

    if (totalSpinsAvailableForAPI <= 0) {
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
         updateUserSession({
            gold_points: data.goldPoints,
            diamond_points: data.diamondPoints,
            bonus_spins_available: data.initialFreeSpinUsedNow && initialFreeSpinIsActuallyAvailable ? currentBonusSpins : Math.max(0, currentBonusSpins - (initialFreeSpinIsActuallyAvailable ? 0 : 1) ),
            initial_free_spin_used: data.initialFreeSpinUsedNow || currentUser.initial_free_spin_used,
        });
        
        setIsWheelSpinningVisually(true);
        setTargetPrizeIndexForWheel(data.prizeIndex);
      } else {
        await fetchUserData(); 
        setIsWheelSpinningVisually(false);
        setIsBackendProcessing(false);
        throw new Error(data.error || 'Failed to spin the wheel. Server did not return a valid prize index.');
      }
    } catch (error) {
      console.error('Wheel spin API error:', error);
      toast({ title: 'Spin Error', description: (error as Error).message || 'Could not complete spin.', variant: 'destructive' });
      setIsBackendProcessing(false);
      setIsWheelSpinningVisually(false);
      await fetchUserData(); 
    }
  }, [currentUser, contextLoadingUser, isBackendProcessing, isWheelSpinningVisually, isAdInProgress, toast, fetchUserData, updateUserSession]);

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

  const handleWatchAdButtonClick = async () => {
    if (!currentUser || contextLoadingUser || isBackendProcessing || isWheelSpinningVisually || isAdInProgress) return;

    const adsWatched = currentUser.ad_spins_used_today_count || 0;
    const dailyLimit = currentUser.daily_ad_views_limit || 3; 

    if (adsWatched >= dailyLimit) {
      toast({ title: 'Ad Limit Reached', description: `You've watched the maximum ads for spins today (${adsWatched}/${dailyLimit}).`, variant: 'default' });
      return;
    }
    setIsAdInProgress(true);
    await showAdsgramAdForSpin();
  };


  if (contextLoadingUser) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height))]">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (telegramAuthError || !currentUser ) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height))] text-center p-4">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-semibold mb-2">{telegramAuthError ? "Authentication Error" : "User Not Found"}</h2>
          <p className="text-muted-foreground mb-4">{telegramAuthError || "Could not load your profile. Please try relaunching or ensure you are logged in."}</p>
          <Button onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" /> Relaunch App</Button>
        </div>
      </AppShell>
    );
  }

  const initialFreeSpinIsAvailableForDisplay = !currentUser?.initial_free_spin_used;
  const spinsAvailableForDisplay = (initialFreeSpinIsAvailableForDisplay ? 1 : 0) + (currentUser?.bonus_spins_available || 0);
  const adsWatchedTodayForSpins = currentUser?.ad_spins_used_today_count || 0;
  const dailyAdViewLimitForSpins = currentUser?.daily_ad_views_limit || 3; 

  return (
    <AppShell>
      <div className="container mx-auto py-4 px-2 sm:px-4 flex flex-col items-center min-h-[calc(100vh-var(--header-height,64px)-var(--bottom-nav-height,64px))] bg-gradient-to-br from-background to-slate-900/50">
        <Card className="w-full max-w-lg shadow-2xl border-2 border-primary/40 overflow-hidden bg-card/95 backdrop-blur-md text-card-foreground">
          <CardHeader className="text-center bg-muted/30 p-3 border-b border-primary/20">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-primary flex items-center justify-center gap-2">
              <Gift className="h-8 w-8 sm:h-9 sm:w-9" /> Wheel of Fortune
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
              Spin for Gold & Diamonds! Good luck, {currentUser?.first_name || 'Player'}!
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
                 (currentUser?.bonus_spins_available || 0) > 0 ? `You have ${currentUser?.bonus_spins_available} bonus spin(s).` :
                 "No bonus spins currently."}
              </p>
               <p className="text-xs text-muted-foreground">
                Ads Watched for Spins Today: {adsWatchedTodayForSpins} / {dailyAdViewLimitForSpins}
              </p>
            </div>
          </CardContent>
           <CardFooter className="bg-muted/30 p-3 sm:p-4 flex flex-col items-center gap-2 border-t border-primary/20">
             <Button
              onClick={handleSpinAPI}
              variant="default"
              className="w-full max-w-xs bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 py-2.5 text-md sm:text-lg rounded-lg shadow-lg transform hover:scale-105 transition-transform"
              disabled={contextLoadingUser || isBackendProcessing || isWheelSpinningVisually || isAdInProgress || spinsAvailableForDisplay <= 0}
            >
              {isWheelSpinningVisually ? (
                  <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
              ) : isBackendProcessing && !isWheelSpinningVisually ? ( 
                  <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
              ) : (
                  <Play className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              )}
              {isWheelSpinningVisually ? 'Spinning...' : (isBackendProcessing && !isWheelSpinningVisually) ? 'Starting...' : 'Spin Now!'}
            </Button>

            <Button
              onClick={handleWatchAdButtonClick}
              variant="outline"
              className="w-full max-w-xs border-yellow-500/80 text-yellow-500 hover:bg-yellow-500/10 py-2.5 text-sm sm:text-base"
              disabled={contextLoadingUser || isBackendProcessing || isWheelSpinningVisually || isAdInProgress || adsWatchedTodayForSpins >= dailyAdViewLimitForSpins}
            >
                {isAdInProgress ? <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin"/> : <Tv className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> }
                {isAdInProgress ? 'Loading Ad...' : `Watch Ad for Spin (${dailyAdViewLimitForSpins - adsWatchedTodayForSpins} left)`}
            </Button>

            <Link href="/referrals" passHref className="w-full max-w-xs">
              <Button variant="secondary" className="w-full py-2.5 text-sm sm:text-base" disabled={!currentUser?.referral_link}>
                <Users className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> Invite Friends & Earn More
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  );
}
