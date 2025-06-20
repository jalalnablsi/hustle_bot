
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Heart, Play, Tv, Gamepad2, AlertTriangle, Coins, Gem, Loader2, MousePointerClick, Award, Star, RefreshCw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from "next/image";
import { useUser } from '@/contexts/UserContext';
import { useAdsgram } from '@/hooks/useAdsgram';

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

const ADSGRAM_STAKE_HEART_BLOCK_ID = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_STAKE_HEART || 'default-stake-heart-block-id';

export default function StakeBuilderGamePage() {
  const GAME_TYPE_IDENTIFIER = 'stake-builder';
  const MAX_POOLED_HEARTS = 5;

  const HEADER_HEIGHT_CSS_VAR = 'var(--header-height, 64px)';
  const BOTTOM_NAV_HEIGHT_CSS_VAR = 'var(--bottom-nav-height, 64px)';

  const GAME_AREA_WIDTH_BASE_INTERNAL = 300;
  const GAME_AREA_HEIGHT_MIN_INTERNAL = 400;
  const INITIAL_BLOCK_HEIGHT_INTERNAL = 20;
  const INITIAL_BASE_WIDTH_INTERNAL = 100;
  const MIN_BLOCK_WIDTH_INTERNAL = 10;

  const GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP_INTERNAL = 1;
  const GOLD_FOR_PERFECT_DROP_INTERNAL = 5;
  const DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS_INTERNAL = 0.5;

  const DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL = 1;
  const MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL = 5;

  const BLOCK_COLORS_INTERNAL = [
    'hsl(var(--chart-1)/0.9)', 'hsl(var(--chart-2)/0.9)', 'hsl(var(--chart-3)/0.9)',
    'hsl(var(--chart-4)/0.9)', 'hsl(var(--chart-5)/0.9)',
    'hsl(var(--accent)/0.8)', 'hsl(var(--primary)/0.8)', 'hsl(var(--secondary)/0.8)',
  ];

  const BLOCK_SLIDE_SPEED_START_INTERNAL = 2.0;
  const BLOCK_SLIDE_SPEED_INCREMENT_BASE_INTERNAL = 0.04;
  const BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR_INTERNAL = 0.0008;
  const MAX_BLOCK_SLIDE_SPEED_INTERNAL = 7.0;
  const PERFECT_DROP_THRESHOLD_INTERNAL = 2.5;

  const { currentUser, loadingUser: contextLoadingUser, updateUserSession, fetchUserData: fetchUserFromContext, telegramAuthError } = useUser();
  const { toast } = useToast();

  const [gameState, setGameState] = useState<'loading_user_data' | 'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts' | 'initializing_game_area'>('loading_user_data');
  const [gameInitializationPending, setGameInitializationPending] = useState(false);
  const [isGameApiLoading, setIsGameApiLoading] = useState(false);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);

  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfectDrops, setConsecutivePerfectDrops] = useState(0);
  const [stakeBuilderHighScore, setStakeBuilderHighScore] = useState(0);

  const [pooledHearts, setPooledHearts] = useState(0);
  const [nextHeartRegenTime, setNextHeartRegenTime] = useState<number | null>(null);
  const [timeToNextHeartDisplay, setTimeToNextHeartDisplay] = useState<string>("Loading...");

  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);
  const [stackVisualOffsetY, setStackVisualOffsetY] = useState(0);

  const [diamondContinuesUsedThisAttempt, setDiamondContinuesUsedThisAttempt] = useState(0);
  const [isAdInProgress, setIsAdInProgress] = useState(false);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const [gameAreaWidth, setGameAreaWidth] = useState(0);

  const parseHeartCountFromUser = useCallback((user: typeof currentUser | null) => {
    if (!user || !user.game_hearts) return 0;
    const heartsData = user.game_hearts[GAME_TYPE_IDENTIFIER];
    return typeof heartsData === 'number' ? Math.min(heartsData, MAX_POOLED_HEARTS) : 0;
  }, [GAME_TYPE_IDENTIFIER]);
  
  const parseNextRegenTimeFromUser = useCallback((user: typeof currentUser | null) => {
    if (user?.last_heart_replenished) {
        const lastReplenish = new Date(user.last_heart_replenished).getTime();
        const threeHoursMs = 3 * 60 * 60 * 1000; 
        return new Date(lastReplenish + threeHoursMs).toISOString();
    }
    return null;
  }, []);

  const updateHeartStateFromApi = useCallback((apiData: any, source: string) => {
    console.log("GamePage: updateHeartStateFromApi called from", source, "with data:", apiData);
    if (!apiData) return false;

    let newHeartsCount = -1;
    let newNextRegenTimestampStr: string | null = null;

    if (apiData.success) {
      if (apiData.hearts && typeof apiData.hearts === 'object' && apiData.hearts[GAME_TYPE_IDENTIFIER] !== undefined) {
        newHeartsCount = Number(apiData.hearts[GAME_TYPE_IDENTIFIER]);
      } else if (apiData.remainingHearts && typeof apiData.remainingHearts === 'object' && apiData.remainingHearts[GAME_TYPE_IDENTIFIER] !== undefined) {
        newHeartsCount = Number(apiData.remainingHearts[GAME_TYPE_IDENTIFIER]);
      } else if (typeof apiData.hearts === 'number') { 
          newHeartsCount = apiData.hearts;
      }

      if (apiData.nextReplenishTime) newNextRegenTimestampStr = apiData.nextReplenishTime;
      else if (apiData.nextReplenish) newNextRegenTimestampStr = apiData.nextReplenish;
      
      if (apiData.adViewsToday !== undefined && currentUser) {
         updateUserSession({ ad_views_today_count: Number(apiData.adViewsToday) });
      }

    } else if (!apiData.success && apiData.message === 'Not ready to replenish hearts yet.' && apiData.nextReplenish) {
      newHeartsCount = parseHeartCountFromUser(currentUser); 
      newNextRegenTimestampStr = apiData.nextReplenish;
      if (source === 'checkBackendReplenish_manual_collect') {
        toast({ title: "Hearts Not Ready", description: "Not time to collect new hearts yet. Timer updated.", variant: "default" });
      }
    } else {
      if (apiData.error && source !== 'fetchInitialHeartStatus_api_hearts' && !source.startsWith('checkBackendReplenish_auto')) { 
        toast({ title: 'Heart Sync Issue', description: `${apiData.error || 'Unknown error'} (Source: ${source})`, variant: "destructive" });
      }
      return false;
    }

    if (newHeartsCount !== -1) {
      setPooledHearts(Math.min(newHeartsCount, MAX_POOLED_HEARTS));
    }

    const currentHeartLevel = newHeartsCount !== -1 ? newHeartsCount : pooledHearts;
    if (newNextRegenTimestampStr) {
      const regenTime = new Date(newNextRegenTimestampStr).getTime();
      if (currentHeartLevel < MAX_POOLED_HEARTS && regenTime > Date.now()) {
          setNextHeartRegenTime(regenTime);
      } else {
           setNextHeartRegenTime(null);
      }
    } else if (currentHeartLevel >= MAX_POOLED_HEARTS) {
      setNextHeartRegenTime(null);
    }
    console.log("GamePage: updateHeartStateFromApi result - New Hearts:", newHeartsCount !== -1 ? newHeartsCount : "unchanged", "New Regen Time:", newNextRegenTimestampStr);
    return true;
  }, [currentUser, pooledHearts, updateUserSession, toast, GAME_TYPE_IDENTIFIER, MAX_POOLED_HEARTS, parseHeartCountFromUser]);

  const fetchUserGameData = useCallback(async (userIdForFetch: string) => {
    console.log("GamePage: fetchUserGameData called for userId:", userIdForFetch);
    if (!userIdForFetch) {
      console.warn("GamePage: fetchUserGameData called without userId.");
      setIsInitialDataLoading(false);
      setGameState('waiting_for_hearts'); // Or some error state
      return;
    }
    setIsInitialDataLoading(true);
    try {
      const highScoreRes = await fetch(`/api/games/high-scores?userId=${userIdForFetch}&gameType=${GAME_TYPE_IDENTIFIER}`);
      if (highScoreRes.ok) {
        const highScoreData = await highScoreRes.json();
        if (highScoreData.success) setStakeBuilderHighScore(highScoreData.highScore || 0);
      } else {
        console.warn("GamePage: Failed to fetch high scores.");
      }

      const heartsRes = await fetch(`/api/games/hearts`); // This endpoint uses cookie, not direct user ID
      if (heartsRes.ok) {
        const heartsApiData = await heartsRes.json();
        const heartsUpdated = updateHeartStateFromApi(heartsApiData, 'fetchInitialHeartStatus_api_hearts');
        const currentHearts = heartsUpdated && heartsApiData.success && heartsApiData.hearts?.[GAME_TYPE_IDENTIFIER] !== undefined
          ? heartsApiData.hearts[GAME_TYPE_IDENTIFIER]
          : parseHeartCountFromUser(currentUser); // Fallback to currentUser parsed hearts
        setGameState(currentHearts > 0 ? 'idle' : 'waiting_for_hearts');
      } else {
         console.warn("GamePage: Failed to fetch hearts data, defaulting to user context hearts.");
         const currentHearts = parseHeartCountFromUser(currentUser);
         setGameState(currentHearts > 0 ? 'idle' : 'waiting_for_hearts');
      }

    } catch (error) {
      toast({ title: 'Error Loading Game Data', description: "Could not load initial game details. Please try relaunching.", variant: 'destructive' });
      setGameState('waiting_for_hearts'); 
      setPooledHearts(0);
      setNextHeartRegenTime(null);
    } finally {
      setIsInitialDataLoading(false);
      console.log("GamePage: fetchUserGameData finished.");
    }
  }, [toast, updateHeartStateFromApi, currentUser, GAME_TYPE_IDENTIFIER, parseHeartCountFromUser]);


  useEffect(() => {
    console.log("GamePage: UserContext effect. ContextLoadingUser:", contextLoadingUser, "CurrentUser ID:", currentUser?.id, "GameState:", gameState);
    if (!contextLoadingUser) { // User context has resolved (either user or error)
        if (currentUser?.id) { // User is authenticated
            if (gameState === 'loading_user_data') { // Initial load for game page
                const initialHearts = parseHeartCountFromUser(currentUser);
                setPooledHearts(initialHearts);
                const initialRegenTimeStr = parseNextRegenTimeFromUser(currentUser);
                 if (initialRegenTimeStr) {
                    const regenTimestamp = new Date(initialRegenTimeStr).getTime();
                    if (initialHearts < MAX_POOLED_HEARTS && regenTimestamp > Date.now()) {
                        setNextHeartRegenTime(regenTimestamp);
                    } else {
                        setNextHeartRegenTime(null);
                    }
                } else {
                    setNextHeartRegenTime(null);
                }
                fetchUserGameData(currentUser.id); // Fetch high scores and confirm hearts
            }
        } else { // User is not authenticated (currentUser is null and not loading)
            setIsInitialDataLoading(false); // No game data to load if no user
            setGameState('idle'); // Or a specific "login required" state
            console.log("GamePage: User not authenticated, setting game state to idle.");
        }
    }
  }, [currentUser, contextLoadingUser, fetchUserGameData, gameState, parseHeartCountFromUser, parseNextRegenTimeFromUser]);
  

  const checkBackendReplenish = useCallback(async (isManualCollectAttempt = false) => {
    if (!currentUser?.id || isGameApiLoading) return;
    if (isManualCollectAttempt && pooledHearts >= MAX_POOLED_HEARTS) {
      toast({ title: "Hearts Full", description: "You already have the maximum hearts." }); return;
    }
    setIsGameApiLoading(true);
    if (isManualCollectAttempt) toast({ description: "Trying to collect heart...", duration: 2000, icon: <RefreshCw className="h-4 w-4 animate-spin" /> });
    try {
      const res = await fetch('/api/games/replenish-hearts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      const previousHearts = pooledHearts;
      const heartsWereUpdatedByApiCall = updateHeartStateFromApi(data, isManualCollectAttempt ? 'checkBackendReplenish_manual_collect' : 'checkBackendReplenish_auto');
      
      if (isManualCollectAttempt && heartsWereUpdatedByApiCall && data.success) {
        const newHearts = (data.hearts && typeof data.hearts === 'object' && data.hearts[GAME_TYPE_IDENTIFIER] !== undefined) 
                            ? Number(data.hearts[GAME_TYPE_IDENTIFIER]) 
                            : (typeof data.hearts === 'number' ? data.hearts : previousHearts);
        if (newHearts > previousHearts) {
          toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> Heart(s) collected! New total: {newHearts}</span> });
        }
      }
      if (heartsWereUpdatedByApiCall && !['playing', 'dropping', 'ad_viewing', 'gameover_attempt', 'initializing_game_area'].includes(gameState)) {
         const currentHeartCount = (data.success && data.hearts?.[GAME_TYPE_IDENTIFIER] !== undefined) 
                                    ? Number(data.hearts[GAME_TYPE_IDENTIFIER]) 
                                    : (typeof data.hearts === 'number' ? data.hearts : pooledHearts);
        setGameState(currentHeartCount > 0 ? 'idle' : 'waiting_for_hearts');
      }

    } catch (error) {
      if (isManualCollectAttempt) toast({ title: "Network Error", description: "Failed to collect heart. Please try again.", variant: "destructive" })
    } finally { setIsGameApiLoading(false); }
  }, [currentUser?.id, updateHeartStateFromApi, isGameApiLoading, pooledHearts, toast, gameState, GAME_TYPE_IDENTIFIER, MAX_POOLED_HEARTS]);

  const getGameAreaWidthCb = useCallback(() => {
    if (typeof window !== 'undefined') {
      const gamePageContainer = document.getElementById('stake-builder-game-page-container');
      if (gamePageContainer) {
        const padding = 16; 
        let calculatedWidth = gamePageContainer.clientWidth - padding * 2;
        calculatedWidth = Math.min(calculatedWidth, GAME_AREA_WIDTH_BASE_INTERNAL + 100);
        const finalWidth = Math.max(MIN_BLOCK_WIDTH_INTERNAL * 8, calculatedWidth);
        console.log("GamePage: Calculated gameAreaWidth:", finalWidth);
        return finalWidth;
      }
      console.warn("GamePage: stake-builder-game-page-container not found for width calculation. Using fallback.");
      return Math.max(MIN_BLOCK_WIDTH_INTERNAL * 8, Math.min(window.innerWidth * 0.90, GAME_AREA_WIDTH_BASE_INTERNAL + 100));
    }
    console.warn("GamePage: window not defined for gameAreaWidth calculation. Using base internal.");
    return GAME_AREA_WIDTH_BASE_INTERNAL;
  }, []);

  const processAttemptOver = useCallback(async (scoreOverride?: number) => {
    console.log("GamePage: processAttemptOver called. Stacked blocks:", stackedBlocks.length);
    const finalScore = scoreOverride !== undefined ? scoreOverride : Math.max(0, stackedBlocks.length - 1);
    setGameState('gameover_attempt');
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = null; setCurrentBlock(null);
    if (currentUser?.id && (finalScore > 0 || currentAttemptGold > 0 || currentAttemptDiamonds > 0)) {
      setIsGameApiLoading(true);
      try {
        const scoreRes = await fetch('/api/games/submit-score', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER, score: finalScore, goldEarned: currentAttemptGold, diamondEarned: currentAttemptDiamonds }),
        });
        const scoreData = await scoreRes.json();
        if (scoreData.success) {
          if (scoreData.totalGold !== undefined && scoreData.totalDiamonds !== undefined) {
            updateUserSession({ gold_points: scoreData.totalGold, diamond_points: scoreData.totalDiamonds });
          }
          if (scoreData.isHighScore && finalScore > stakeBuilderHighScore) {
            setStakeBuilderHighScore(finalScore);
            toast({ title: "New High Score!", description: `You reached ${finalScore} points!`, icon: <Award className="h-5 w-5 text-yellow-400" /> });
          } else {
             toast({ title: "Score Saved!", description: `Score: ${finalScore}, Gold: ${currentAttemptGold.toFixed(0)}, Diamonds: ${currentAttemptDiamonds.toFixed(2)}`});
          }
        } else { toast({ title: "Score Submission Issue", description: scoreData.error || "Could not save score.", variant: "destructive" }); }
      } catch (error) { toast({ title: "Network Error", description: "Score submission failed.", variant: "destructive" }); }
      finally { setIsGameApiLoading(false); }
    } else {
      setIsGameApiLoading(false); // Ensure loading state is reset even if no score to submit
    }
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, stakeBuilderHighScore, updateUserSession, toast, GAME_TYPE_IDENTIFIER]);


  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number) => {
    if (!gameAreaRef.current || gameAreaWidth <= 0) {
      console.error("GamePage: spawnNewBlock called with invalid gameAreaWidth or gameAreaRef. Width:", gameAreaWidth);
      processAttemptOver(0); // Game over if area not ready, score 0
      return;
    }
    const currentScore = Math.max(0, stackedBlocks.length - 1);
    const speedRamp = currentScore * BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR_INTERNAL;
    const speedIncrement = BLOCK_SLIDE_SPEED_INCREMENT_BASE_INTERNAL + speedRamp;
    const currentSpeed = Math.min(BLOCK_SLIDE_SPEED_START_INTERNAL + (currentScore * speedIncrement), MAX_BLOCK_SLIDE_SPEED_INTERNAL);
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 - currentTopWidth / 4 : gameAreaWidth - currentTopWidth * 3 / 4,
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT_INTERNAL - 5,
      width: currentTopWidth, color: BLOCK_COLORS_INTERNAL[stackedBlocks.length % BLOCK_COLORS_INTERNAL.length],
      direction: Math.random() < 0.5 ? 1 : -1, speed: Math.max(0.5, currentSpeed),
    });
  }, [gameAreaWidth, stackedBlocks.length, processAttemptOver]);

  const initializeNewGameAttempt = useCallback(() => {
    console.log("GamePage: initializeNewGameAttempt called. gameAreaWidth:", gameAreaWidth);
    if (!gameAreaRef.current || gameAreaWidth <= 0) {
      setGameState('idle');
      toast({ title: "Game Area Error", description: "Could not initialize game area. Please ensure the window is focused and try again.", variant: "destructive" });
      setGameInitializationPending(false); setIsGameApiLoading(false);
      console.error("GamePage: initializeNewGameAttempt - Game Area Error. Width:", gameAreaWidth, "Ref:", gameAreaRef.current);
      return;
    }
    setCurrentAttemptGold(0); setCurrentAttemptDiamonds(0); setConsecutivePerfectDrops(0);
    setDiamondContinuesUsedThisAttempt(0); setStackVisualOffsetY(0);
    const baseBlockX = (gameAreaWidth - INITIAL_BASE_WIDTH_INTERNAL) / 2;
    const baseBlock: StackedBlock = { id: 'base', x: baseBlockX, y: GAME_AREA_HEIGHT_MIN_INTERNAL - INITIAL_BLOCK_HEIGHT_INTERNAL, width: INITIAL_BASE_WIDTH_INTERNAL, color: 'hsl(var(--muted))' };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y);
    setGameState('playing');
    setIsGameApiLoading(false); // Ensure API loading is false once game starts
    console.log("GamePage: Game initialized. State set to 'playing'.");
  }, [gameAreaWidth, spawnNewBlock, toast]);

  const startGameAttempt = useCallback(async () => {
    console.log("GamePage: startGameAttempt called. PooledHearts:", pooledHearts, "IsGameApiLoading:", isGameApiLoading, "GameState:", gameState, "GameAreaWidth:", gameAreaWidth, "GameInitPending:", gameInitializationPending);
    if (!currentUser?.id) { toast({ title: "Login Required", description: "Please launch via Telegram.", variant: "destructive" }); return; }
    if (pooledHearts <= 0) { toast({ title: "No Hearts Left!", description: "Watch an ad or wait for hearts to regenerate."}); return;}
    if (isGameApiLoading || ['playing', 'ad_viewing', 'dropping', 'initializing_game_area'].includes(gameState) || gameInitializationPending) {
       if (isGameApiLoading) toast({ title: "System Busy", description: "Please wait." }); return;
    }
    if (gameAreaWidth <= 0 || !gameAreaRef.current) {
       toast({ title: "Game Area Not Ready", description: "Please wait for the game area to load or resize your window.", variant: "default" });
       console.warn("GamePage: startGameAttempt - Game Area not ready. Width:", gameAreaWidth, "Ref:", gameAreaRef.current);
       // Attempt to re-calculate width if it's zero
       if (gameAreaWidth <= 0) {
           const newWidth = getGameAreaWidthCb();
           if (newWidth > 0) setGameAreaWidth(newWidth);
           else { console.error("GamePage: Recalculating gameAreaWidth in startGameAttempt also failed."); return;}
       }
       return;
    }
    
    setIsGameApiLoading(true);
    setGameState('initializing_game_area'); // Indicate game setup is in progress
    try {
      const res = await fetch('/api/games/use-heart', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: 'Could Not Start Game', description: data.error || "Failed to use heart.", variant: 'destructive' });
        if (data.error?.toLowerCase().includes("no hearts")) { setPooledHearts(0); setGameState('waiting_for_hearts'); }
        else { setGameState('idle'); } 
        setIsGameApiLoading(false);
      } else {
        updateHeartStateFromApi(data, 'startGameAttempt_useHeart');
        setGameInitializationPending(true); // This will trigger initializeNewGameAttempt via useEffect
      }
    } catch (error) { 
        toast({ title: 'Network Error', description:"Failed to start game. Please check connection.", variant: 'destructive' }); 
        setIsGameApiLoading(false);
        setGameState('idle');
    } 
  }, [currentUser?.id, pooledHearts, toast, gameState, updateHeartStateFromApi, isGameApiLoading, gameAreaWidth, GAME_TYPE_IDENTIFIER, gameInitializationPending, getGameAreaWidthCb]);

  const continueCurrentAttempt = useCallback(() => {
    console.log("GamePage: continueCurrentAttempt called. Stacked blocks:", stackedBlocks.length, "GameAreaWidth:", gameAreaWidth);
    if (gameAreaWidth <= 0 || !gameAreaRef.current) {
        toast({ title: "Game Area Error", description:"Game area not ready. Please refresh or resize window.", variant: "destructive" }); setGameState('idle'); return;
    }
    if (stackedBlocks.length > 0) {
      const topBlock = stackedBlocks[stackedBlocks.length - 1];
      spawnNewBlock(topBlock.width, topBlock.y - stackVisualOffsetY);
      setGameState('playing');
    } else { 
        setGameInitializationPending(true); // No blocks, re-init
    }
  }, [stackedBlocks, spawnNewBlock, stackVisualOffsetY, gameAreaWidth, toast]);

  const handleDropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock || isGameApiLoading || gameAreaWidth <=0) return;
    setGameState('dropping'); 
    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    if (!topStackBlock) { processAttemptOver(0); return; }

    let newBlockX = currentBlock.x, newBlockWidth = currentBlock.width, gainedGoldThisDrop = 0, gainedDiamondsThisDrop = 0, isPerfectDrop = false;
    const overlapStart = Math.max(currentBlock.x, topStackBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth >= MIN_BLOCK_WIDTH_INTERNAL * 0.7) {
      newBlockX = overlapStart; newBlockWidth = overlapWidth;
      const xDiff = Math.abs(currentBlock.x - topStackBlock.x);
      const widthDiff = Math.abs(currentBlock.width - topStackBlock.width);

      if (xDiff < PERFECT_DROP_THRESHOLD_INTERNAL && widthDiff < PERFECT_DROP_THRESHOLD_INTERNAL + 2) {
        isPerfectDrop = true; 
        newBlockX = topStackBlock.x;
        newBlockWidth = topStackBlock.width;
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP_INTERNAL;
        const newConsecutivePerfects = consecutivePerfectDrops + 1; setConsecutivePerfectDrops(newConsecutivePerfects);
        if (newConsecutivePerfects >= 3) {
          gainedDiamondsThisDrop = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS_INTERNAL; setConsecutivePerfectDrops(0);
          toast({ description: <span className="flex items-center text-sm"><Gem className="h-4 w-4 mr-1 text-sky-400" /> 3x Perfect! +{gainedDiamondsThisDrop.toFixed(2)}💎</span>, duration: 1500, className: "bg-primary/20 border-primary/50" });
        }
      } else { 
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP_INTERNAL; 
        setConsecutivePerfectDrops(0); 
      }
      
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);
      if (gainedDiamondsThisDrop > 0) setCurrentAttemptDiamonds(d => parseFloat((d + gainedDiamondsThisDrop).toFixed(4)));
      
      if (newBlockWidth < MIN_BLOCK_WIDTH_INTERNAL) { processAttemptOver(); return; }

      const newBlockY = topStackBlock.y - INITIAL_BLOCK_HEIGHT_INTERNAL;
      const newStackedBlock: StackedBlock = { id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: newBlockY, width: newBlockWidth, color: currentBlock.color, isPerfect: isPerfectDrop };
      setStackedBlocks(prev => [...prev, newStackedBlock]);
      
      const visualNewBlockTopY = newBlockY - stackVisualOffsetY;
      if (visualNewBlockTopY < GAME_AREA_HEIGHT_MIN_INTERNAL / 2.3 && stackedBlocks.length + 1 > 5) {
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT_INTERNAL);
      }

      spawnNewBlock(newBlockWidth, newBlockY - stackVisualOffsetY);
      setGameState('playing');

    } else {
      processAttemptOver();
    }
  }, [gameState, currentBlock, stackedBlocks, consecutivePerfectDrops, spawnNewBlock, processAttemptOver, toast, stackVisualOffsetY, isGameApiLoading, gameAreaWidth]);

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock || gameAreaWidth <= 0 || !currentBlock.speed || currentBlock.speed <= 0) {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); gameLoopRef.current = null; return;
    }
    setCurrentBlock(prev => {
      if (!prev) return null;
      let newX = prev.x + prev.direction * prev.speed;
      let newDirection = prev.direction;
      if (newX + prev.width > gameAreaWidth) { newX = gameAreaWidth - prev.width; newDirection = -1; }
      else if (newX < 0) { newX = 0; newDirection = 1; }
      return { ...prev, x: newX, direction: newDirection as (1 | -1) };
    });
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, currentBlock, gameAreaWidth]);

  const handleAdsgramRewardForHeart = useCallback(() => {
    toast({ title: "Ad Watched!", description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> Heart reward processing...</span>, icon: <Tv className="text-primary" /> });
    setTimeout(() => { if(currentUser?.id) fetchUserFromContext(false, true); }, 2500); 
    setIsAdInProgress(false);
    setGameState(pooledHearts + 1 > 0 ? 'idle' : 'waiting_for_hearts');
  }, [toast, fetchUserFromContext, pooledHearts, currentUser?.id]);

  const handleAdsgramErrorForHeart = useCallback(() => { 
    setIsAdInProgress(false); 
    setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
  }, [pooledHearts]);

  const handleAdsgramCloseForHeart = useCallback(() => { 
    setIsAdInProgress(false); 
    setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
  }, [pooledHearts]);

  const showAdsgramAdForHeart = useAdsgram({
    blockId: ADSGRAM_STAKE_HEART_BLOCK_ID,
    onReward: handleAdsgramRewardForHeart,
    onError: handleAdsgramErrorForHeart,
    onClose: handleAdsgramCloseForHeart,
  });

  const handleWatchAdForHeartClick = async () => {
    if (!currentUser || isAdInProgress || isGameApiLoading) {
      toast({ title: "Cannot Watch Ad", description: isAdInProgress ? "Ad already in progress." : "System busy or not logged in.", variant: "default" });
      return;
    }
    const adsWatched = currentUser.ad_views_today_count || 0;
    const dailyAdLimit = currentUser.daily_ad_views_limit || 50;
    if (adsWatched >= dailyAdLimit) {
      toast({ title: "Daily Ad Limit Reached", description: `You've watched the max ${dailyAdLimit} ads for today.`, variant: "default" }); return;
    }
    if (pooledHearts >= MAX_POOLED_HEARTS) {
      toast({ title: "Hearts Full", description: "You already have the maximum hearts.", variant: "default" }); return;
    }
    setIsAdInProgress(true);
    setGameState('ad_viewing');
    await showAdsgramAdForHeart();
  };

  const handleSpendDiamondsToContinue = useCallback(async () => {
    if (!currentUser?.id || typeof currentUser.diamond_points !== 'number' || isGameApiLoading) {
       toast({ title: "Action Unavailable", description: "Cannot continue with diamonds.", variant: "default" }); return;
    }
    if (diamondContinuesUsedThisAttempt >= MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL) {
      toast({ title: "Continue Limit Reached", description: "Max diamond continues used for this attempt.", variant: "default" }); return;
    }
    if (currentUser.diamond_points < DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL) {
      toast({ title: "Not Enough Diamonds", description: `You need ${DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL} diamonds to continue.`, variant: "destructive" }); return;
    }
    setIsGameApiLoading(true);
    try {
      const response = await fetch('/api/games/spend-diamonds-to-continue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, diamondsToSpend: DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to use diamonds.");
      updateUserSession({ diamond_points: data.newDiamondBalance });
      setDiamondContinuesUsedThisAttempt(prev => prev + 1);
      toast({ description: ( <span className="flex items-center text-sm"> <Gem className="h-4 w-4 mr-1 text-sky-400" /> -{DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL} Diamond. Go! </span> ), duration: 2000 });
      continueCurrentAttempt();
    } catch (error) { toast({ title: "Failed to Continue", description: (error as Error).message, variant: "destructive" }); }
    finally { setIsGameApiLoading(false); }
  }, [currentUser, diamondContinuesUsedThisAttempt, continueCurrentAttempt, toast, updateUserSession, isGameApiLoading]);

  useEffect(() => {
    const initializeGameAreaSizing = () => {
      const newWidth = getGameAreaWidthCb();
      if (newWidth > 0) {
        setGameAreaWidth(newWidth);
        console.log("GamePage: Game area width set on resize/mount:", newWidth);
      } else {
        console.warn("GamePage: getGameAreaWidthCb returned 0 or less on resize/mount. Will retry shortly.");
        // Retry if width calculation failed initially
        setTimeout(initializeGameAreaSizing, 200);
      }
    };

    if (typeof window !== 'undefined') { 
        const resizeObserver = new ResizeObserver(() => {
            const newWidth = getGameAreaWidthCb();
            if (newWidth > 0) setGameAreaWidth(newWidth);
        });
        const gamePageContainer = document.getElementById('stake-builder-game-page-container');
        if (gamePageContainer) resizeObserver.observe(gamePageContainer);
        
        // Initial call with a slight delay for DOM rendering
        const timeoutId = setTimeout(initializeGameAreaSizing, 100);
        
        return () => { 
            if (gamePageContainer) resizeObserver.unobserve(gamePageContainer);
            resizeObserver.disconnect();
            clearTimeout(timeoutId);
        };
    }
  }, [getGameAreaWidthCb]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime && nextHeartRegenTime > Date.now()) {
      const updateTimerDisplay = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) { 
            setTimeToNextHeartDisplay("Collect Heart"); 
            if (intervalId) clearInterval(intervalId); 
            // Attempt auto-collect if conditions met
            if (currentUser?.id && !isGameApiLoading) checkBackendReplenish(false);
        } else {
          const remainingMs = nextHeartRegenTime - now;
          const hours = Math.floor(remainingMs / (36e5)); 
          const minutes = Math.floor((remainingMs % (36e5)) / (6e4)); 
          const seconds = Math.floor((remainingMs % (6e4)) / 1000);
          setTimeToNextHeartDisplay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      };
      updateTimerDisplay(); intervalId = setInterval(updateTimerDisplay, 1000);
    } else if (pooledHearts < MAX_POOLED_HEARTS && (!nextHeartRegenTime || (nextHeartRegenTime && nextHeartRegenTime <= Date.now()))) {
        setTimeToNextHeartDisplay("Collect Heart");
        if (currentUser?.id && !isGameApiLoading && gameState !== 'loading_user_data' && !isInitialDataLoading) { // Avoid calling during initial loads
            checkBackendReplenish(false); // Attempt auto-collect
        }
    } else if (pooledHearts >= MAX_POOLED_HEARTS) {
        setTimeToNextHeartDisplay("Hearts Full!");
    } else {
        setTimeToNextHeartDisplay("Loading...");
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime, currentUser?.id, isGameApiLoading, checkBackendReplenish, gameState, isInitialDataLoading]);

  useEffect(() => {
    console.log("GamePage: gameInitializationPending effect. Pending:", gameInitializationPending, "GameAreaWidth:", gameAreaWidth);
    if (gameInitializationPending && gameAreaWidth > 0 && gameAreaRef.current) { 
        initializeNewGameAttempt(); 
        setGameInitializationPending(false); 
    } else if (gameInitializationPending && (gameAreaWidth <=0 || !gameAreaRef.current)) {
        setGameInitializationPending(false);
        setIsGameApiLoading(false); // Ensure loading is stopped
        setGameState('idle');
        toast({ title: "Game Setup Error", description: "Failed to prepare game area. Game area might be too small or not visible.", variant: "destructive" });
        console.error("GamePage: Game setup error - gameAreaWidth or gameAreaRef invalid.", { gameAreaWidth, gameAreaRefCurrent: gameAreaRef.current });
    }
  }, [gameInitializationPending, gameAreaWidth, initializeNewGameAttempt, toast]);

  useEffect(() => {
    if (gameState === 'playing' && currentBlock && gameAreaWidth > 0 && currentBlock.speed > 0 && !gameLoopRef.current) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if ((gameState !== 'playing' || !currentBlock || (currentBlock && currentBlock.speed <=0)) && gameLoopRef.current) { 
        cancelAnimationFrame(gameLoopRef.current); 
        gameLoopRef.current = null; 
    }
    return () => { if (gameLoopRef.current) { cancelAnimationFrame(gameLoopRef.current); gameLoopRef.current = null; } };
  }, [gameState, gameLoop, currentBlock, gameAreaWidth]);

  const HeartIconPlain = useCallback((props: {inline?: boolean, className?: string}) => <Heart className={cn("inline h-4 w-4 text-red-400 fill-red-400", props.inline ? "mx-0.5" : "mr-1", props.className)} />, []);
  const canContinueWithDiamonds = currentUser && typeof currentUser.diamond_points === 'number' && currentUser.diamond_points >= DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL && diamondContinuesUsedThisAttempt < MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL;
  const adsForHeartsWatchedToday = currentUser?.ad_views_today_count || 0;
  const dailyAdLimitForHearts = currentUser?.daily_ad_views_limit || 50;
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS && adsForHeartsWatchedToday < dailyAdLimitForHearts;
  const isHeartRegenCountdownActive = timeToNextHeartDisplay && !timeToNextHeartDisplay.includes("Collect") && !timeToNextHeartDisplay.includes("Full") && !timeToNextHeartDisplay.includes("Loading");
  const isReadyToCollectHeartManual = timeToNextHeartDisplay === "Collect Heart" && pooledHearts < MAX_POOLED_HEARTS;
  
  const effectiveGameState = (contextLoadingUser || isInitialDataLoading) ? 'loading_user_data' : gameState;
  const playButtonDisabled = pooledHearts <= 0 || isGameApiLoading || ['playing', 'ad_viewing', 'dropping', 'initializing_game_area'].includes(effectiveGameState) || gameAreaWidth <= 0 || gameInitializationPending || effectiveGameState === 'loading_user_data';

  if (effectiveGameState === 'loading_user_data') {
    return <AppShell><div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">Loading Stake Builder...</p></div></AppShell>;
  }
  if (telegramAuthError && !currentUser) { // Explicitly check for auth error if no user
     return <AppShell><div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center text-center p-4" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}><AlertTriangle className="h-12 w-12 text-destructive mb-3" /><h2 className="text-xl font-semibold text-foreground">Authentication Error</h2><p className="text-muted-foreground">{telegramAuthError}</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-3">Relaunch App</Button></div></AppShell>;
  }
   if (!currentUser && !contextLoadingUser && !telegramAuthError) { // No user, no loading, no specific auth error
     return <AppShell><div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center text-center p-4" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}><AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" /><h2 className="text-xl font-semibold text-foreground">Access Denied</h2><p className="text-muted-foreground">Please launch the app via Telegram to play.</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-3">Relaunch App</Button></div></AppShell>;
  }
  
  return (
    <AppShell>
      <div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full bg-gradient-to-br from-slate-900 via-purple-950/80 to-slate-900 text-slate-100 overflow-hidden relative" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }} onClick={effectiveGameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={effectiveGameState === 'playing' ? 0 : -1} aria-label={effectiveGameState === 'playing' ? "Drop Block" : "Game Area"} onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space' || e.key === 'Enter') && effectiveGameState === 'playing') handleDropBlock(); }}>
        <div className="w-full px-2 sm:px-4 py-2 bg-slate-900/90 backdrop-blur-sm shadow-md border-b border-primary/30 z-20">
          <div className="flex flex-wrap justify-between items-center max-w-5xl mx-auto gap-y-1 gap-x-2 sm:gap-x-3">
            <div className="flex items-center space-x-1">
              {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                <Heart key={`life-${i}`} className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300 stroke-[1.5px]", i < pooledHearts ? "text-red-500 fill-red-500 animate-pulse [animation-duration:1.5s]" : "text-slate-600 fill-slate-700 stroke-slate-800")} />
              ))}
            </div>
            <div className="flex items-center gap-1 xs:gap-2 text-xs sm:text-sm">
              <span className="flex items-center gap-1 p-1 px-1.5 xs:px-2 bg-slate-700/60 rounded-md shadow"> <Coins className="text-yellow-400 h-3 w-3 xs:h-4 xs:w-4" /> <span className="text-yellow-300 font-semibold tabular-nums">{currentAttemptGold}</span> </span>
              {currentAttemptDiamonds > 0 && (<span className="flex items-center gap-1 p-1 px-1.5 xs:px-2 bg-slate-700/60 rounded-md shadow"> <Gem className="text-sky-400 h-3 w-3 xs:h-4 xs:w-4" /> <span className="text-sky-300 font-semibold tabular-nums">{currentAttemptDiamonds.toFixed(2)}</span> </span>)}
            </div>
            <p className="text-xs sm:text-sm font-bold flex items-center justify-end gap-1 sm:gap-1.5"><Award className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 filter drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]" /><span className="text-slate-100 tabular-nums">{stakeBuilderHighScore}</span></p>
          </div>
        </div>
        <div className="flex-grow w-full flex flex-col items-center justify-center overflow-hidden p-2 relative">
          {(effectiveGameState === 'playing' || effectiveGameState === 'dropping') && gameAreaWidth > 0 && stackedBlocks.length > 0 ? (
            <div ref={gameAreaRef} className="relative bg-black/40 border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl shadow-primary/30" style={{ height: `${GAME_AREA_HEIGHT_MIN_INTERNAL}px`, width: `${gameAreaWidth}px`, backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.08) 0%, hsl(var(--accent)/0.04) 40%, hsl(var(--background)/0.3) 100%)', cursor: 'pointer', willChange: 'transform' }}>
              <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
                {stackedBlocks.map(block => (<div key={block.id} className={cn("absolute rounded-sm border", block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50 shadow-[0_0_15px_rgba(250,204,21,0.6)]", block.id === 'base' ? 'border-muted/50' : 'border-border/60')} style={{ left: `${block.x}px`, top: `${block.y}px`, width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT_INTERNAL}px`, backgroundColor: block.color, willChange: 'left, top, width', transition: 'all 0.1s linear' }} />))}
              </div>
              {currentBlock && (<div className="absolute rounded-sm border border-white/40 shadow-lg" style={{ left: `${currentBlock.x}px`, top: `${currentBlock.y}px`, width: `${currentBlock.width}px`, height: `${INITIAL_BLOCK_HEIGHT_INTERNAL}px`, backgroundColor: currentBlock.color, willChange: 'left, top, width' }} /> )}
              {effectiveGameState === 'playing' && (<p className="text-sm text-center text-foreground/80 py-1.5 flex items-center justify-center gap-1.5 z-20 absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/30 px-3 rounded-full"><MousePointerClick className="h-4 w-4" /> Tap or Press Space</p>)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-4 max-w-md w-full">
              {effectiveGameState === 'gameover_attempt' && (
                <div className="p-4 bg-card/80 rounded-lg shadow-xl border border-primary/30 w-full mb-3">
                  <Award size={48} className="text-yellow-400 mb-2 mx-auto" />
                  <h2 className="text-2xl font-bold text-slate-100 font-headline">Attempt Over!</h2>
                  <p className="text-lg">Score: <span className="font-bold text-slate-100">{stackedBlocks.length > 0 ? stackedBlocks.length - 1 : 0}</span></p>
                  <p className="text-md text-yellow-400 flex items-center justify-center gap-1"><Coins className="inline h-4 w-4" />{currentAttemptGold}</p>
                  {currentAttemptDiamonds > 0 && <p className="text-md text-sky-400 flex items-center justify-center gap-1"><Gem className="inline h-4 w-4" />{currentAttemptDiamonds.toFixed(2)}</p>}
                  {canContinueWithDiamonds && (<Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400/10 mt-3">{isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />} Use {DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL}💎 to Continue ({MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL - diamondContinuesUsedThisAttempt} left)</Button>)}
                </div>
              )}
              {effectiveGameState === 'initializing_game_area' && (
                 <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                    <p className="text-muted-foreground">Preparing your game...</p>
                 </div>
              )}
              <Button onClick={startGameAttempt} disabled={playButtonDisabled} size="lg" className={cn("w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-xl py-3 rounded-lg shadow-xl transform hover:scale-105 transition-transform", playButtonDisabled && "opacity-50 cursor-not-allowed")}>{(isGameApiLoading && pooledHearts > 0 && !['playing', 'ad_viewing', 'dropping'].includes(effectiveGameState)) || gameInitializationPending || effectiveGameState === 'initializing_game_area' ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-3 h-6 w-6" />}Play Game (-1 <HeartIconPlain inline={true} />)</Button>
              <div className="w-full p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                 {(effectiveGameState === 'loading_user_data' || timeToNextHeartDisplay === "Loading...") && pooledHearts < MAX_POOLED_HEARTS ? (<div className="flex justify-center items-center py-1"><Loader2 className="h-5 w-5 animate-spin text-slate-400"/><span className="ml-2 text-sm text-slate-400">Heart status...</span></div>)
                 : pooledHearts >= MAX_POOLED_HEARTS ? (<p className="text-sm text-green-400 font-semibold flex items-center justify-center gap-1.5"><CheckCircle className="h-4 w-4"/> Hearts Full!</p>)
                 : isHeartRegenCountdownActive ? (<div className="text-center"><p className="text-xs text-muted-foreground">Next <HeartIconPlain inline={true} /> In:</p><p className="text-lg font-semibold font-mono text-yellow-300">{timeToNextHeartDisplay}</p><Button variant="outline" size="sm" className="w-full mt-1 opacity-60 cursor-not-allowed" disabled>Waiting...</Button></div>)
                 : isReadyToCollectHeartManual ? (<Button onClick={() => checkBackendReplenish(true)} disabled={isGameApiLoading} variant="outline" className="w-full border-green-500 text-green-400 hover:bg-green-500/10">{isGameApiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/> }Collect Heart</Button>)
                 : ( <p className="text-sm text-slate-400 text-center">{timeToNextHeartDisplay === "Loading..." ? <Loader2 className="inline h-4 w-4 animate-spin"/> : "Check again soon for hearts."}</p> )}
              </div>
              {canWatchAdForPooledHeart && (<Button onClick={handleWatchAdForHeartClick} disabled={isGameApiLoading || isAdInProgress || effectiveGameState === 'loading_user_data'} variant="outline" size="md" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 transition-colors duration-200 ease-in-out shadow-md">{isAdInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tv className="mr-2 h-4 w-4" />} Watch Ad for +1 <HeartIconPlain inline={true} /></Button>)}
              {['idle', 'waiting_for_hearts', 'gameover_attempt'].includes(effectiveGameState) && !isAdInProgress && <p className="text-xs text-muted-foreground mt-3">Tap screen or press Space to drop blocks. Perfect drops earn more!</p> }
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
