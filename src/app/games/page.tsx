
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

  const [gameState, setGameState] = useState<'loading_user_data' | 'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts'>('loading_user_data');
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
    if (typeof heartsData === 'number') return heartsData;
    // Deprecated old schema access, assuming game_hearts is now just { 'game-id': count }
    // if (typeof heartsData === 'object' && heartsData !== null && typeof heartsData.count === 'number') return heartsData.count;
    return 0;
  }, [GAME_TYPE_IDENTIFIER]);
  
  const parseNextRegenTimeFromUser = useCallback((user: typeof currentUser | null) => {
    // For Stake Builder, heart regen is now handled by a global last_heart_replenished timestamp on the user object
    // and a fixed 3-hour interval. The specific game_hearts[GAME_ID].nextRegen is deprecated.
    if (user?.last_heart_replenished) {
        const lastReplenish = new Date(user.last_heart_replenished).getTime();
        const threeHoursMs = 3 * 60 * 60 * 1000; 
        return new Date(lastReplenish + threeHoursMs).toISOString();
    }
    return null;
  }, []);


  const updateHeartStateFromApi = useCallback((apiData: any, source: string) => {
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

      if (apiData.nextReplenishTime) newNextRegenTimestampStr = apiData.nextReplenishTime; // From /api/games/hearts
      else if (apiData.nextReplenish) newNextRegenTimestampStr = apiData.nextReplenish; // From /api/games/replenish-hearts
      
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
      if (apiData.error && source !== 'fetchInitialHeartStatus_api_hearts') { // Avoid toast on initial silent fetch
        toast({ title: 'Heart Sync Issue', description: `${apiData.error || 'Unknown error'} (Source: ${source})`, variant: "destructive" });
      }
      return false; // Indicate that state might not be reliably updated
    }

    if (newHeartsCount !== -1) {
      setPooledHearts(Math.min(newHeartsCount, MAX_POOLED_HEARTS));
    }

    if (newNextRegenTimestampStr) {
      const regenTime = new Date(newNextRegenTimestampStr).getTime();
      const currentHeartLevel = newHeartsCount !== -1 ? newHeartsCount : pooledHearts; // Use updated count if available
      if (currentHeartLevel < MAX_POOLED_HEARTS && regenTime > Date.now()) {
          setNextHeartRegenTime(regenTime);
      } else {
           setNextHeartRegenTime(null); // Full or regen time passed
      }
    } else if (newHeartsCount >= MAX_POOLED_HEARTS || pooledHearts >= MAX_POOLED_HEARTS) {
      setNextHeartRegenTime(null); // Hearts are full
    }
    return true; // Indicate successful update path
  }, [currentUser, pooledHearts, updateUserSession, toast, GAME_TYPE_IDENTIFIER, MAX_POOLED_HEARTS, parseHeartCountFromUser]);

  const fetchUserGameData = useCallback(async (userIdForFetch: string) => {
    if (!userIdForFetch) {
      setIsInitialDataLoading(false); // Ensure loading stops if no user ID
      setGameState('waiting_for_hearts'); // Or an error state if more appropriate
      return;
    }
    setIsInitialDataLoading(true);
    try {
      const highScoreRes = await fetch(`/api/games/high-scores?userId=${userIdForFetch}&gameType=${GAME_TYPE_IDENTIFIER}`);
      if (highScoreRes.ok) {
        const highScoreData = await highScoreRes.json();
        if (highScoreData.success) setStakeBuilderHighScore(highScoreData.highScore || 0);
      } // else: Do nothing, high score is not critical for game start

      const heartsRes = await fetch(`/api/games/hearts`); // This endpoint should get user ID from cookie
      const heartsApiData = await heartsRes.json();
      const heartsUpdated = updateHeartStateFromApi(heartsApiData, 'fetchInitialHeartStatus_api_hearts');
      
      const currentHearts = heartsUpdated && heartsApiData.success && heartsApiData.hearts?.[GAME_TYPE_IDENTIFIER] !== undefined
        ? heartsApiData.hearts[GAME_TYPE_IDENTIFIER]
        : parseHeartCountFromUser(currentUser); // Fallback to context if API parse fails but API itself was "ok"

      setGameState(currentHearts > 0 ? 'idle' : 'waiting_for_hearts');

    } catch (error) {
      toast({ title: 'Error Loading Game Data', description: "Could not load initial game details. Please try relaunching.", variant: 'destructive' });
      setGameState('waiting_for_hearts'); 
      setPooledHearts(0);
      setNextHeartRegenTime(null);
    } finally {
      setIsInitialDataLoading(false);
    }
  }, [toast, updateHeartStateFromApi, currentUser, GAME_TYPE_IDENTIFIER, parseHeartCountFromUser]);

  useEffect(() => {
    if (!contextLoadingUser) { // Only proceed if UserContext has finished its loading
        if (currentUser?.id) {
            if (gameState === 'loading_user_data') { // Fetch only if in initial loading state
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
                fetchUserGameData(currentUser.id);
            }
        } else { // No current user after UserContext loading
            setIsInitialDataLoading(false);
            setGameState('idle'); // Or a more specific "login_required" state
             if (!telegramAuthError) { // Avoid double toast if UserContext already showed an error
                // toast({ title: "User Not Logged In", description: "Please launch via Telegram to play.", variant: "default" });
            }
        }
    }
  }, [currentUser, contextLoadingUser, fetchUserGameData, gameState, toast, parseHeartCountFromUser, parseNextRegenTimeFromUser, telegramAuthError]);
  

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
        body: JSON.stringify({ userId: currentUser.id }), // This API likely needs to use cookie, not userId in body for security. For now, matching existing.
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
      // Update game state if not actively playing based on new heart count
      if (heartsWereUpdatedByApiCall && !['playing', 'dropping', 'ad_viewing', 'gameover_attempt'].includes(gameState)) {
        const currentHeartCount = (data.success && data.hearts?.[GAME_TYPE_IDENTIFIER] !== undefined) 
                                    ? Number(data.hearts[GAME_TYPE_IDENTIFIER]) 
                                    : (typeof data.hearts === 'number' ? data.hearts : pooledHearts);
        setGameState(currentHeartCount > 0 ? 'idle' : 'waiting_for_hearts');
      }

    } catch (error) {
      if (isManualCollectAttempt) toast({ title: "Network Error", description: "Failed to collect heart. Please try again.", variant: "destructive" })
    } finally { setIsGameApiLoading(false); }
  }, [currentUser?.id, updateHeartStateFromApi, isGameApiLoading, pooledHearts, toast, gameState, GAME_TYPE_IDENTIFIER, MAX_POOLED_HEARTS]);

  const getGameAreaWidth = useCallback(() => {
    if (typeof window !== 'undefined') {
      const gamePageContainer = document.getElementById('stake-builder-game-page-container');
      if (gamePageContainer) {
        const padding = 16; // Assuming p-4 or similar on parent
        let calculatedWidth = gamePageContainer.clientWidth - padding * 2;
        calculatedWidth = Math.min(calculatedWidth, GAME_AREA_WIDTH_BASE_INTERNAL + 100); // Cap max width somewhat
        return Math.max(MIN_BLOCK_WIDTH_INTERNAL * 8, calculatedWidth); // Ensure minimum reasonable width
      }
      // Fallback if container not found, less precise
      return Math.max(MIN_BLOCK_WIDTH_INTERNAL * 8, Math.min(window.innerWidth * 0.90, GAME_AREA_WIDTH_BASE_INTERNAL + 100));
    }
    return GAME_AREA_WIDTH_BASE_INTERNAL; // Default for SSR or if window is not available
  }, []);

  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number) => {
    if (!gameAreaRef.current || gameAreaWidth <= 0) return;
    const currentScore = Math.max(0, stackedBlocks.length - 1); // Score is number of successfully stacked blocks
    const speedRamp = currentScore * BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR_INTERNAL;
    const speedIncrement = BLOCK_SLIDE_SPEED_INCREMENT_BASE_INTERNAL + speedRamp;
    const currentSpeed = Math.min(BLOCK_SLIDE_SPEED_START_INTERNAL + (currentScore * speedIncrement), MAX_BLOCK_SLIDE_SPEED_INTERNAL);
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 - currentTopWidth / 4 : gameAreaWidth - currentTopWidth * 3 / 4, // Start off-screen or partially
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT_INTERNAL - 5, // Position above current stack
      width: currentTopWidth, color: BLOCK_COLORS_INTERNAL[stackedBlocks.length % BLOCK_COLORS_INTERNAL.length],
      direction: Math.random() < 0.5 ? 1 : -1, speed: Math.max(0.5, currentSpeed), // Ensure speed is positive
    });
  }, [gameAreaWidth, stackedBlocks.length]);

  const initializeNewGameAttempt = useCallback(() => {
    if (!gameAreaRef.current || gameAreaWidth <= 0) {
      setGameState('idle');
      toast({ title: "Game Area Error", description: "Could not initialize game area. Please refresh.", variant: "destructive" });
      setGameInitializationPending(false); return;
    }
    setCurrentAttemptGold(0); setCurrentAttemptDiamonds(0); setConsecutivePerfectDrops(0);
    setDiamondContinuesUsedThisAttempt(0); setStackVisualOffsetY(0);
    const baseBlockX = (gameAreaWidth - INITIAL_BASE_WIDTH_INTERNAL) / 2;
    const baseBlock: StackedBlock = { id: 'base', x: baseBlockX, y: GAME_AREA_HEIGHT_MIN_INTERNAL - INITIAL_BLOCK_HEIGHT_INTERNAL, width: INITIAL_BASE_WIDTH_INTERNAL, color: 'hsl(var(--muted))' };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y);
    setGameState('playing');
  }, [gameAreaWidth, spawnNewBlock, toast]);

  const startGameAttempt = useCallback(async () => {
    if (!currentUser?.id) { toast({ title: "Login Required", description: "Please launch via Telegram.", variant: "destructive" }); return; }
    if (pooledHearts <= 0 || isGameApiLoading || ['playing', 'ad_viewing'].includes(gameState) || gameAreaWidth <= 0 || gameInitializationPending) {
      if (pooledHearts <= 0 && gameState !== 'playing' && !isGameApiLoading) toast({ title: "No Hearts Left!", description: "Watch an ad or wait for hearts to regenerate."});
      else if (gameAreaWidth <= 0 && pooledHearts > 0) toast({ title: "Game Area Not Ready", description: "Please wait a moment." });
      else if (isGameApiLoading) toast({ title: "System Busy", description: "Please wait." }); 
      return;
    }
    setIsGameApiLoading(true);
    try {
      const res = await fetch('/api/games/use-heart', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }), // Backend should ideally use cookie
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: 'Could Not Start Game', description: data.error || "Failed to use heart.", variant: 'destructive' });
        if (data.error?.toLowerCase().includes("no hearts")) { setPooledHearts(0); setGameState('waiting_for_hearts'); }
        setIsGameApiLoading(false); // Reset on failure
      } else {
        updateHeartStateFromApi(data, 'startGameAttempt_useHeart'); // Update heart count from API response
        setGameInitializationPending(true); // This will trigger initializeNewGameAttempt via useEffect
        // isGameApiLoading will be set to false after initialization or if initialization fails
      }
    } catch (error) { 
        toast({ title: 'Network Error', description:"Failed to start game. Please check connection.", variant: 'destructive' }); 
        setIsGameApiLoading(false);
    } 
    // No finally here for isGameApiLoading, as initializeNewGameAttempt should handle it or it's set on error.
  }, [currentUser?.id, pooledHearts, toast, gameState, updateHeartStateFromApi, isGameApiLoading, gameAreaWidth, GAME_TYPE_IDENTIFIER, gameInitializationPending]);

  const processAttemptOver = useCallback(async () => {
    const finalScore = Math.max(0, stackedBlocks.length - 1);
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
      // If no score or rewards, just ensure loading is false if it was somehow set.
      setIsGameApiLoading(false);
    }
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, stakeBuilderHighScore, updateUserSession, toast, GAME_TYPE_IDENTIFIER]);

  const continueCurrentAttempt = useCallback(() => {
    if (stackedBlocks.length > 0 && gameAreaWidth > 0) {
      const topBlock = stackedBlocks[stackedBlocks.length - 1];
      spawnNewBlock(topBlock.width, topBlock.y - stackVisualOffsetY);
      setGameState('playing');
    } else if (gameAreaWidth <= 0) {
        toast({ title: "Game Area Error", description:"Please refresh the page.", variant: "destructive" }); setGameState('idle');
    } else { 
        // This implies stackedBlocks is empty, so need full re-init
        setGameInitializationPending(true); 
    }
  }, [stackedBlocks, spawnNewBlock, stackVisualOffsetY, gameAreaWidth, toast]);

  const handleDropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock || isGameApiLoading) return;
    setGameState('dropping'); // Transition state
    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    if (!topStackBlock) { processAttemptOver(); return; } // Should not happen if game initialized

    let newBlockX = currentBlock.x, newBlockWidth = currentBlock.width, gainedGoldThisDrop = 0, gainedDiamondsThisDrop = 0, isPerfectDrop = false;
    const overlapStart = Math.max(currentBlock.x, topStackBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth >= MIN_BLOCK_WIDTH_INTERNAL * 0.7) { // Need at least 70% of min block width to stack
      newBlockX = overlapStart; newBlockWidth = overlapWidth;
      const xDiff = Math.abs(currentBlock.x - topStackBlock.x);
      const widthDiff = Math.abs(currentBlock.width - topStackBlock.width); // This can be significant if it's a perfect drop on a smaller base

      if (xDiff < PERFECT_DROP_THRESHOLD_INTERNAL && widthDiff < PERFECT_DROP_THRESHOLD_INTERNAL + 2) { // More lenient on width for perfect
        isPerfectDrop = true; 
        newBlockX = topStackBlock.x; // Align perfectly with the block below
        newBlockWidth = topStackBlock.width; // Take the width of the block below
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP_INTERNAL;
        const newConsecutivePerfects = consecutivePerfectDrops + 1; setConsecutivePerfectDrops(newConsecutivePerfects);
        if (newConsecutivePerfects >= 3) {
          gainedDiamondsThisDrop = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS_INTERNAL; setConsecutivePerfectDrops(0); // Reset after 3
          toast({ description: <span className="flex items-center text-sm"><Gem className="h-4 w-4 mr-1 text-sky-400" /> 3x Perfect! +{gainedDiamondsThisDrop.toFixed(2)}💎</span>, duration: 1500, className: "bg-primary/20 border-primary/50" });
        }
      } else { 
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP_INTERNAL; 
        setConsecutivePerfectDrops(0); 
      }
      
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);
      if (gainedDiamondsThisDrop > 0) setCurrentAttemptDiamonds(d => parseFloat((d + gainedDiamondsThisDrop).toFixed(4)));
      
      if (newBlockWidth < MIN_BLOCK_WIDTH_INTERNAL) { processAttemptOver(); return; } // Game over if block too small

      const newBlockY = topStackBlock.y - INITIAL_BLOCK_HEIGHT_INTERNAL;
      const newStackedBlock: StackedBlock = { id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: newBlockY, width: newBlockWidth, color: currentBlock.color, isPerfect: isPerfectDrop };
      setStackedBlocks(prev => [...prev, newStackedBlock]);
      
      const visualNewBlockTopY = newBlockY - stackVisualOffsetY; // Where the new block *appears* to be
      if (visualNewBlockTopY < GAME_AREA_HEIGHT_MIN_INTERNAL / 2.3 && stackedBlocks.length + 1 > 5) { // +1 because stackedBlocks isn't updated yet for this check
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT_INTERNAL);
      }

      if (gameAreaWidth > 0) { 
        spawnNewBlock(newBlockWidth, newBlockY - stackVisualOffsetY); // Spawn next block based on current one's new Y (adjusted for offset)
        setGameState('playing'); // Back to playing state for next block
      } else {
        processAttemptOver(); // Should not happen if gameAreaWidth was check before
      }
    } else {
      processAttemptOver(); // No significant overlap, game over for this attempt
    }
    // currentBlock will be replaced by spawnNewBlock or nulled by processAttemptOver
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
    setTimeout(() => { fetchUserFromContext(); }, 2500); 
    setIsAdInProgress(false);
    if(gameState === 'ad_viewing') setGameState(pooledHearts + 1 > 0 ? 'idle' : 'waiting_for_hearts'); // Update state after ad
  }, [toast, fetchUserFromContext, gameState, pooledHearts]);

  const handleAdsgramErrorForHeart = useCallback(() => { 
    setIsAdInProgress(false); 
    if(gameState === 'ad_viewing') setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
  }, [gameState, pooledHearts]);

  const handleAdsgramCloseForHeart = useCallback(() => { 
    setIsAdInProgress(false); 
    if(gameState === 'ad_viewing') setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
  }, [gameState, pooledHearts]);

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
    const dailyAdLimit = currentUser.daily_ad_views_limit || 50; // General ad limit
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
    const handleResize = () => { const newWidth = getGameAreaWidth(); if (newWidth > 0) setGameAreaWidth(newWidth); };
    if (typeof window !== 'undefined') { window.addEventListener('resize', handleResize); handleResize(); } // Initial call
    return () => { if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize); };
  }, [getGameAreaWidth]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime && nextHeartRegenTime > Date.now()) {
      const updateTimerDisplay = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) { 
            setTimeToNextHeartDisplay("Collect Heart"); 
            if (intervalId) clearInterval(intervalId); 
            // Consider auto-calling checkBackendReplenish here if desired, or rely on manual click
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
    } else if (pooledHearts >= MAX_POOLED_HEARTS) {
        setTimeToNextHeartDisplay("Hearts Full!");
    } else {
        setTimeToNextHeartDisplay("Loading..."); // Initial or unknown state
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime]);

  useEffect(() => {
    if (gameInitializationPending && gameAreaWidth > 0 && gameAreaRef.current) { 
        initializeNewGameAttempt(); 
        setGameInitializationPending(false); 
        setIsGameApiLoading(false); // Ensure loading spinner from startGameAttempt is cleared
    } else if (gameInitializationPending && (gameAreaWidth <=0 || !gameAreaRef.current)) {
        // Game area not ready, reset initialization pending and API loading
        setGameInitializationPending(false);
        setIsGameApiLoading(false);
        setGameState('idle'); // Or a more specific error state
        toast({ title: "Game Setup Error", description: "Failed to prepare game area. Please try again.", variant: "destructive" });
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
  const adsForHeartsWatchedToday = currentUser?.ad_views_today_count || 0; // Using general ad counter for hearts
  const dailyAdLimitForHearts = currentUser?.daily_ad_views_limit || 50;
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS && adsForHeartsWatchedToday < dailyAdLimitForHearts;
  const isHeartRegenCountdownActive = timeToNextHeartDisplay && !timeToNextHeartDisplay.includes("Collect") && !timeToNextHeartDisplay.includes("Full") && !timeToNextHeartDisplay.includes("Loading");
  const isReadyToCollectHeartManual = timeToNextHeartDisplay === "Collect Heart" && pooledHearts < MAX_POOLED_HEARTS;
  
  const playButtonDisabled = pooledHearts <= 0 || isGameApiLoading || ['playing', 'ad_viewing', 'dropping'].includes(gameState) || gameAreaWidth <= 0 || gameInitializationPending;
  const effectiveGameState = isInitialDataLoading ? 'loading_user_data' : gameState;

  if (contextLoadingUser || effectiveGameState === 'loading_user_data') {
    return <AppShell><div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="mt-4 text-muted-foreground">Loading Stake Builder...</p></div></AppShell>;
  }
  if (telegramAuthError || (!currentUser && !contextLoadingUser)) {
     return <AppShell><div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center text-center p-4" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}><AlertTriangle className="h-12 w-12 text-destructive mb-3" /><h2 className="text-xl font-semibold text-foreground">{telegramAuthError ? "Authentication Error" : "Access Denied"}</h2><p className="text-muted-foreground">{telegramAuthError || "Please launch via Telegram."}</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-3">Relaunch App</Button></div></AppShell>;
  }
  
  return (
    <AppShell>
      <div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full bg-gradient-to-br from-slate-900 via-purple-950/80 to-slate-900 text-slate-100 overflow-hidden relative" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }} onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={gameState === 'playing' ? 0 : -1} aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"} onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space' || e.key === 'Enter') && gameState === 'playing') handleDropBlock(); }}>
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
          {(gameState === 'playing' || gameState === 'dropping') && gameAreaWidth > 0 && stackedBlocks.length > 0 ? (
            <div ref={gameAreaRef} className="relative bg-black/40 border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl shadow-primary/30" style={{ height: `${GAME_AREA_HEIGHT_MIN_INTERNAL}px`, width: `${gameAreaWidth}px`, backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.08) 0%, hsl(var(--accent)/0.04) 40%, hsl(var(--background)/0.3) 100%)', cursor: 'pointer', willChange: 'transform' }}>
              <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
                {stackedBlocks.map(block => (<div key={block.id} className={cn("absolute rounded-sm border", block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50 shadow-[0_0_15px_rgba(250,204,21,0.6)]", block.id === 'base' ? 'border-muted/50' : 'border-border/60')} style={{ left: `${block.x}px`, top: `${block.y}px`, width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT_INTERNAL}px`, backgroundColor: block.color, willChange: 'left, top, width', transition: 'all 0.1s linear' }} />))}
              </div>
              {currentBlock && (<div className="absolute rounded-sm border border-white/40 shadow-lg" style={{ left: `${currentBlock.x}px`, top: `${currentBlock.y}px`, width: `${currentBlock.width}px`, height: `${INITIAL_BLOCK_HEIGHT_INTERNAL}px`, backgroundColor: currentBlock.color, willChange: 'left, top, width' }} /> )}
              {gameState === 'playing' && (<p className="text-sm text-center text-foreground/80 py-1.5 flex items-center justify-center gap-1.5 z-20 absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/30 px-3 rounded-full"><MousePointerClick className="h-4 w-4" /> Tap or Press Space</p>)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-4 max-w-md w-full">
              {gameState === 'gameover_attempt' && (
                <div className="p-4 bg-card/80 rounded-lg shadow-xl border border-primary/30 w-full mb-3">
                  <Award size={48} className="text-yellow-400 mb-2 mx-auto" />
                  <h2 className="text-2xl font-bold text-slate-100 font-headline">Attempt Over!</h2>
                  <p className="text-lg">Score: <span className="font-bold text-slate-100">{stackedBlocks.length > 0 ? stackedBlocks.length - 1 : 0}</span></p>
                  <p className="text-md text-yellow-400 flex items-center justify-center gap-1"><Coins className="inline h-4 w-4" />{currentAttemptGold}</p>
                  {currentAttemptDiamonds > 0 && <p className="text-md text-sky-400 flex items-center justify-center gap-1"><Gem className="inline h-4 w-4" />{currentAttemptDiamonds.toFixed(2)}</p>}
                  {canContinueWithDiamonds && (<Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400/10 mt-3">{isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />} Use {DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL}💎 to Continue ({MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL - diamondContinuesUsedThisAttempt} left)</Button>)}
                </div>
              )}
              <Button onClick={startGameAttempt} disabled={playButtonDisabled} size="lg" className={cn("w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-xl py-3 rounded-lg shadow-xl transform hover:scale-105 transition-transform", playButtonDisabled && "opacity-50 cursor-not-allowed")}>{(isGameApiLoading && pooledHearts > 0 && !['playing', 'ad_viewing', 'dropping'].includes(gameState)) || gameInitializationPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-3 h-6 w-6" />}Play Game (-1 <HeartIconPlain inline={true} />)</Button>
              <div className="w-full p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                 {isInitialDataLoading && timeToNextHeartDisplay === "Loading..." && pooledHearts < MAX_POOLED_HEARTS ? (<div className="flex justify-center items-center py-1"><Loader2 className="h-5 w-5 animate-spin text-slate-400"/><span className="ml-2 text-sm text-slate-400">Heart status...</span></div>)
                 : pooledHearts >= MAX_POOLED_HEARTS ? (<p className="text-sm text-green-400 font-semibold flex items-center justify-center gap-1.5"><CheckCircle className="h-4 w-4"/> Hearts Full!</p>)
                 : isHeartRegenCountdownActive ? (<div className="text-center"><p className="text-xs text-muted-foreground">Next <HeartIconPlain inline={true} /> In:</p><p className="text-lg font-semibold font-mono text-yellow-300">{timeToNextHeartDisplay}</p><Button variant="outline" size="sm" className="w-full mt-1 opacity-60 cursor-not-allowed" disabled>Waiting...</Button></div>)
                 : isReadyToCollectHeartManual ? (<Button onClick={() => checkBackendReplenish(true)} disabled={isGameApiLoading} variant="outline" className="w-full border-green-500 text-green-400 hover:bg-green-500/10">{isGameApiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/> }Collect Heart</Button>)
                 : ( <p className="text-sm text-slate-400 text-center">{timeToNextHeartDisplay === "Loading..." ? <Loader2 className="inline h-4 w-4 animate-spin"/> : "Unable to determine heart status."}</p> )}
              </div>
              {canWatchAdForPooledHeart && (<Button onClick={handleWatchAdForHeartClick} disabled={isGameApiLoading || isAdInProgress} variant="outline" size="md" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 transition-colors duration-200 ease-in-out shadow-md">{isAdInProgress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tv className="mr-2 h-4 w-4" />} Watch Ad for +1 <HeartIconPlain inline={true} /></Button>)}
              {['idle', 'waiting_for_hearts', 'gameover_attempt'].includes(gameState) && !isAdInProgress && <p className="text-xs text-muted-foreground mt-3">Tap screen or press Space to drop blocks. Perfect drops earn more!</p> }
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
