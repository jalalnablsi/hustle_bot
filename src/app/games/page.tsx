
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Heart, Play, Tv, Gamepad2, AlertTriangle, Info, Coins, Gem, Loader2, MousePointerClick, Award, Star, RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { useUser } from '@/contexts/UserContext';

const GAME_AREA_WIDTH_BASE = 320;
const GAME_AREA_HEIGHT_MIN = 450;
const INITIAL_BLOCK_HEIGHT = 20;
const INITIAL_BASE_WIDTH = 120;
const MIN_BLOCK_WIDTH = 10;

const MAX_POOLED_HEARTS = 5;
// HEART_REPLENISH_COOLDOWN_MS is now primarily for client-side fallback if server doesn't provide nextReplenishTime
const HEART_REPLENISH_COOLDOWN_MS = 3 * 60 * 60 * 1000; 

const GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP = 1;
const GOLD_FOR_PERFECT_DROP = 5;
const DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS = 0.5;

const DIAMONDS_TO_CONTINUE_ATTEMPT = 1;
const MAX_DIAMOND_CONTINUES_PER_ATTEMPT = 5;
const AD_WATCH_DURATION_SECONDS = 5;

const BLOCK_COLORS = [
  'hsl(var(--chart-1)/0.9)', 'hsl(var(--chart-2)/0.9)', 'hsl(var(--chart-3)/0.9)',
  'hsl(var(--chart-4)/0.9)', 'hsl(var(--chart-5)/0.9)',
  'hsl(var(--accent)/0.8)', 'hsl(var(--primary)/0.8)', 'hsl(var(--secondary)/0.8)',
];

const BLOCK_SLIDE_SPEED_START = 1.8;
const BLOCK_SLIDE_SPEED_INCREMENT_BASE = 0.04; 
const BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR = 0.0008;
const MAX_BLOCK_SLIDE_SPEED = 7.0;

const PERFECT_DROP_THRESHOLD = 2.5;
const GAME_TYPE_IDENTIFIER = 'stake-builder';

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

const HEADER_HEIGHT_CSS_VAR = 'var(--header-height, 64px)';
const BOTTOM_NAV_HEIGHT_CSS_VAR = 'var(--bottom-nav-height, 64px)';

export default function StakeBuilderGamePage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();
  const [isGameApiLoading, setIsGameApiLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [gameState, setGameState] = useState<'loading_user_data' | 'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts'>('loading_user_data');

  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfectDrops, setConsecutivePerfectDrops] = useState(0);
  const [stakeBuilderHighScore, setStakeBuilderHighScore] = useState(0);

  const [pooledHearts, setPooledHearts] = useState(0);
  const [nextHeartRegenTime, setNextHeartRegenTime] = useState<number | null>(null);
  const [timeToNextHeartDisplay, setTimeToNextHeartDisplay] = useState<string>("");

  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);
  const [stackVisualOffsetY, setStackVisualOffsetY] = useState(0);

  const [diamondContinuesUsedThisAttempt, setDiamondContinuesUsedThisAttempt] = useState(0);

  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(AD_WATCH_DURATION_SECONDS);
  const [adProgress, setAdProgress] = useState(0);
  const [adPurpose, setAdPurpose] = useState<'gain_pooled_heart' | null>(null);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const { toast } = useToast();

  const getGameAreaWidth = useCallback(() => {
    if (typeof window !== 'undefined') {
      const gamePageContainer = document.getElementById('stake-builder-game-page-container');
      if (gamePageContainer) {
        return window.innerWidth < 768 ? gamePageContainer.clientWidth * 0.95 : Math.min(gamePageContainer.clientWidth * 0.9, GAME_AREA_WIDTH_BASE + 200);
      }
      return window.innerWidth < 768 ? window.innerWidth * 0.95 : Math.min(window.innerWidth * 0.9, GAME_AREA_WIDTH_BASE + 200);
    }
    return GAME_AREA_WIDTH_BASE + 150;
  }, []);
  const [gameAreaWidth, setGameAreaWidth] = useState(getGameAreaWidth());

  useEffect(() => {
    const handleResize = () => setGameAreaWidth(getGameAreaWidth());
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameAreaWidth]);


  const updateHeartStateFromApi = useCallback((apiData: any, source?: string) => {
    if (!apiData) {
      console.warn("updateHeartStateFromApi called with null/undefined apiData from source:", source);
      if (source && source !== 'fetchInitialHeartStatus') {
        toast({ title: 'Heart Sync Issue', description: `Received no data from server (${source}).`, variant: "destructive" });
      }
      return;
    }

    let newHeartsCount = -1;
    let newNextRegenTimestampStr: string | null = null;

    if (apiData.success) {
        // Standardized structure for most calls (use-heart, watch-ad-for-heart, successful replenish)
        if (apiData.hearts && typeof apiData.hearts === 'object' && apiData.hearts !== null && typeof apiData.hearts[GAME_TYPE_IDENTIFIER] === 'number') {
            newHeartsCount = apiData.hearts[GAME_TYPE_IDENTIFIER];
        } else if (typeof apiData.hearts === 'number') { // Flat structure
             newHeartsCount = apiData.hearts;
        } else if (apiData.remainingHearts && typeof apiData.remainingHearts === 'object' && apiData.remainingHearts !== null && typeof apiData.remainingHearts[GAME_TYPE_IDENTIFIER] === 'number') {
            newHeartsCount = apiData.remainingHearts[GAME_TYPE_IDENTIFIER]; // From use-heart
        }
        
        // nextReplenishTime might come from /api/games/hearts or /api/games/replenish-hearts (as nextReplenish)
        newNextRegenTimestampStr = apiData.nextReplenishTime || apiData.nextReplenish || null;
        
        if (apiData.adViewsToday !== undefined && currentUser) {
            updateUserSession({ ad_views_today_count: apiData.adViewsToday });
        }
    } else if (!apiData.success && apiData.message === 'Not ready to replenish hearts yet.' && apiData.nextReplenish) {
      // For "not ready" from replenish-hearts, DONT update hearts count from this response.
      // The hearts count should have been fetched from /api/games/hearts already.
      // Only update the nextReplenishTime.
      newHeartsCount = pooledHearts; // Keep existing hearts
      newNextRegenTimestampStr = apiData.nextReplenish;
      if (source === 'checkBackendReplenish_manual_collect') { // Only toast if user clicked collect
          toast({ title: "Hearts Not Ready", description: "Not time to collect new hearts yet. Timer updated.", variant: "default"});
      }
    } else {
      // General failure
      if (source !== 'fetchInitialHeartStatus' && apiData.error) { // Don't toast for initial silent fetch failure
        toast({ title: 'Heart Sync Failed', description: `${apiData.error} (Source: ${source || 'Unknown'})`, variant: "destructive" });
      }
      // If it's not a "not ready" message and not success, don't change existing heart state unless it's an error on initial load
      if (source === 'fetchInitialHeartStatus' && !apiData.success) {
        setPooledHearts(0); // Default to 0 on initial load failure
        setNextHeartRegenTime(null);
      }
      return;
    }
    
    if (newHeartsCount !== -1) {
      setPooledHearts(Math.min(newHeartsCount, MAX_POOLED_HEARTS));
      if (newNextRegenTimestampStr && newHeartsCount < MAX_POOLED_HEARTS) {
        const regenTime = new Date(newNextRegenTimestampStr).getTime();
        // Ensure regenTime is in the future
        setNextHeartRegenTime(regenTime > Date.now() ? regenTime : null);
      } else {
        setNextHeartRegenTime(null); // Hearts full or no valid future time
      }

      // Update game state based on new heart count if not in active play/ad states
      if (gameState !== 'playing' && gameState !== 'gameover_attempt' && gameState !== 'ad_viewing' && gameState !== 'dropping') {
        setGameState(newHeartsCount > 0 ? 'idle' : 'waiting_for_hearts');
      }
    }
  }, [currentUser, pooledHearts, updateUserSession, toast, gameState]);


  // Countdown timer effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;

    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime && nextHeartRegenTime > Date.now()) {
      const updateTimer = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          setTimeToNextHeartDisplay("Ready!");
          clearInterval(intervalId); 
        } else {
          const remainingMs = nextHeartRegenTime - now;
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
          setTimeToNextHeartDisplay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      };
      updateTimer(); // Initial call
      intervalId = setInterval(updateTimer, 1000);
    } else if (pooledHearts < MAX_POOLED_HEARTS && (!nextHeartRegenTime || nextHeartRegenTime <= Date.now())) {
      setTimeToNextHeartDisplay("Collect Heart");
    } else if (pooledHearts >= MAX_POOLED_HEARTS) {
      setTimeToNextHeartDisplay("Hearts Full!");
    } else {
      setTimeToNextHeartDisplay(""); 
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime]);

  // Fetches initial hearts and next replenish time from /api/games/hearts
  const fetchInitialHeartStatus = useCallback(async (userIdForFetch: string) => {
    if (!userIdForFetch || isGameApiLoading) return;
    // This is part of initial loading, so setIsGameApiLoading is managed by fetchUserGameData
    try {
      const res = await fetch(`/api/games/hearts`); // GET request, user identified by cookie
      const data = await res.json();
      updateHeartStateFromApi(data, 'fetchInitialHeartStatus');
    } catch (error) {
      console.error('Error fetching initial heart status:', error);
      toast({ title: "Network Error", description: "Failed to fetch initial heart status.", variant: "destructive" });
      setPooledHearts(0); // Default to 0 on error
      setNextHeartRegenTime(null);
      setGameState('waiting_for_hearts');
    }
  }, [isGameApiLoading, toast, updateHeartStateFromApi]);
  
  // Tries to replenish hearts, called by user clicking "Collect Heart"
  const attemptHeartReplenish = useCallback(async () => {
    if (!currentUser?.id || isGameApiLoading || pooledHearts >= MAX_POOLED_HEARTS) {
      if (pooledHearts >= MAX_POOLED_HEARTS) toast({title: "Hearts Full", description: "You already have the maximum hearts."});
      return;
    }
    setIsGameApiLoading(true);
    toast({ description: "Trying to collect heart...", duration: 2000, icon: <RefreshCw className="h-4 w-4 animate-spin" /> });
    try {
      const res = await fetch('/api/games/replenish-hearts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      const previousHearts = pooledHearts;
      updateHeartStateFromApi(data, 'checkBackendReplenish_manual_collect');

      if (data.success) {
        const newHearts = data.hearts && typeof data.hearts === 'object' && data.hearts[GAME_TYPE_IDENTIFIER] !== undefined 
            ? data.hearts[GAME_TYPE_IDENTIFIER] 
            : typeof data.hearts === 'number' ? data.hearts : previousHearts;
        if (newHearts > previousHearts) {
          toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> Heart(s) collected! New total: {newHearts}</span>, duration: 2500 });
        }
      } // Error/not ready toasts are handled by updateHeartStateFromApi
    } catch (error) {
      console.error('Error during manual heart replenish:', error);
      toast({ title: "Network Error", description: "Failed to collect heart.", variant: "destructive" })
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, updateHeartStateFromApi, isGameApiLoading, pooledHearts, toast]);


  const fetchUserGameData = useCallback(async (userIdForFetch: string) => {
    if (!userIdForFetch) return;
    setIsGameApiLoading(true);
    setIsInitialLoading(true);
    try {
      const highScoreRes = await fetch(`/api/games/high-scores?userId=${userIdForFetch}&gameType=${GAME_TYPE_IDENTIFIER}`);
      if (highScoreRes.ok) {
        const highScoreData = await highScoreRes.json();
        if (highScoreData.success) setStakeBuilderHighScore(highScoreData.highScore || 0);
      } else console.warn("Failed to fetch high score.");

      await fetchInitialHeartStatus(userIdForFetch);

    } catch (error) {
      toast({ title: 'Error Loading Game Data', description: (error as Error).message, variant: 'destructive' });
       setGameState('waiting_for_hearts'); // Fallback state
    } finally {
      setIsInitialLoading(false);
      setIsGameApiLoading(false);
      // Game state (idle/waiting_for_hearts) is primarily set by updateHeartStateFromApi after fetchInitialHeartStatus
    }
  }, [toast, fetchInitialHeartStatus]);

  useEffect(() => {
    if (currentUser?.id && gameState === 'loading_user_data') {
      fetchUserGameData(currentUser.id);
    } else if (!contextLoadingUser && !currentUser && gameState === 'loading_user_data') {
      setIsInitialLoading(false);
      setGameState('idle'); // Or a state indicating login is required
      setPooledHearts(0);
      setNextHeartRegenTime(null);
    }
  }, [currentUser, contextLoadingUser, fetchUserGameData, gameState]);

  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number) => {
    const currentScore = Math.max(0, stackedBlocks.length - 1);
    const speedRamp = currentScore * BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR;
    const speedIncrement = BLOCK_SLIDE_SPEED_INCREMENT_BASE + speedRamp;
    const currentSpeed = Math.min(BLOCK_SLIDE_SPEED_START + (currentScore * speedIncrement), MAX_BLOCK_SLIDE_SPEED);

    const newBlockWidth = Math.max(currentTopWidth * 0.95, MIN_BLOCK_WIDTH);
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 - newBlockWidth / 4 : gameAreaWidth - newBlockWidth * 3 / 4,
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT - 5,
      width: newBlockWidth,
      color: BLOCK_COLORS[stackedBlocks.length % BLOCK_COLORS.length],
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: currentSpeed,
    });
  }, [gameAreaWidth, stackedBlocks.length]);

  const initializeNewGameAttempt = useCallback(() => {
    setCurrentAttemptGold(0);
    setCurrentAttemptDiamonds(0);
    setConsecutivePerfectDrops(0);
    setDiamondContinuesUsedThisAttempt(0);
    setStackVisualOffsetY(0);

    const baseBlockX = (gameAreaWidth - INITIAL_BASE_WIDTH) / 2;
    const baseBlock: StackedBlock = {
      id: 'base', x: baseBlockX,
      y: GAME_AREA_HEIGHT_MIN - INITIAL_BLOCK_HEIGHT,
      width: INITIAL_BASE_WIDTH, color: 'hsl(var(--muted))',
    };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y);
    setGameState('playing');
  }, [gameAreaWidth, spawnNewBlock]);

  const startGameAttempt = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: "User Not Loaded", description: "Please wait or refresh.", variant: "destructive" });
      return;
    }
    if (pooledHearts <= 0 || gameState === 'playing' || gameState === 'ad_viewing' || isGameApiLoading) {
      if (pooledHearts <= 0) toast({ title: "No Hearts Left!", description: "Replenish hearts or watch an ad." });
      return;
    }

    setIsGameApiLoading(true);
    try {
      const res = await fetch('/api/games/use-heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: 'Could Not Start Game', description: data.error || "Failed to use a heart.", variant: 'destructive' });
        if (currentUser.id) await fetchInitialHeartStatus(currentUser.id); // Re-sync if use-heart failed
      } else {
        updateHeartStateFromApi(data, 'startGameAttempt_useHeart'); // API should return new heart count
        initializeNewGameAttempt(); 
      }
    } catch (error) {
      toast({ title: 'Network Error', description: "Could not start game.", variant: 'destructive' });
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, pooledHearts, initializeNewGameAttempt, toast, fetchInitialHeartStatus, gameState, updateHeartStateFromApi, isGameApiLoading]);

  const processAttemptOver = useCallback(async () => {
    const finalScore = Math.max(0, stackedBlocks.length - 1); // Score is number of blocks successfully stacked on base
    setGameState('gameover_attempt'); 
    
    const finalGold = currentAttemptGold;
    const finalDiamonds = currentAttemptDiamonds;
    
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = null;
    setCurrentBlock(null);

    if (currentUser?.id && (finalScore > 0 || finalGold > 0 || finalDiamonds > 0)) {
      // Non-blocking score submission
      fetch('/api/games/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER,
          score: finalScore, goldEarned: finalGold, diamondEarned: finalDiamonds,
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            if (data.totalGold !== undefined && data.totalDiamonds !== undefined) {
              updateUserSession({ gold_points: data.totalGold, diamond_points: data.totalDiamonds });
            }
            if (data.isHighScore && finalScore > stakeBuilderHighScore) {
              setStakeBuilderHighScore(finalScore);
              toast({ title: "New High Score!", description: `You reached ${finalScore} points!`, icon: <Award className="h-5 w-5 text-yellow-400" /> });
            } else {
              toast({ title: "Score Saved!", description: `Score: ${finalScore}, Gold: ${finalGold}, Diamonds: ${finalDiamonds.toFixed(2)}`});
            }
          } else {
            toast({ title: "Score Submission Issue", description: data.error || "Could not save score.", variant: "destructive" });
          }
        })
        .catch(error => {
          toast({ title: "Network Error", description: "Score submission failed: " + (error as Error).message, variant: "destructive" });
        });
    }
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, stakeBuilderHighScore, updateUserSession, toast]);
  
  const continueCurrentAttempt = useCallback(() => {
    if (stackedBlocks.length > 0) {
      const topBlock = stackedBlocks[stackedBlocks.length - 1];
      spawnNewBlock(topBlock.width, topBlock.y - stackVisualOffsetY); // Use adjusted Y
      setGameState('playing');
    } else {
      // This case should ideally not happen if continue is only offered after some blocks are stacked
      initializeNewGameAttempt();
    }
  }, [stackedBlocks, spawnNewBlock, initializeNewGameAttempt, stackVisualOffsetY]);

  const handleDropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock || isGameApiLoading) return;
    
    setGameState('dropping'); 

    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    if (!topStackBlock) { processAttemptOver(); return; }

    let newBlockX = currentBlock.x;
    let newBlockWidth = currentBlock.width;
    let gainedGoldThisDrop = 0;
    let gainedDiamondsThisDrop = 0;
    let isPerfectDrop = false;

    const overlapStart = Math.max(currentBlock.x, topStackBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth >= MIN_BLOCK_WIDTH * 0.7) { 
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      const xDiff = Math.abs(currentBlock.x - topStackBlock.x);
      const widthDiff = Math.abs(currentBlock.width - topStackBlock.width);

      if (xDiff < PERFECT_DROP_THRESHOLD && widthDiff < PERFECT_DROP_THRESHOLD + 2) {
        isPerfectDrop = true;
        newBlockX = topStackBlock.x; // Align perfectly
        newBlockWidth = topStackBlock.width; // Keep width
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP;
        const newConsecutivePerfects = consecutivePerfectDrops + 1;
        setConsecutivePerfectDrops(newConsecutivePerfects);
        if (newConsecutivePerfects >= 3) {
          gainedDiamondsThisDrop = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS;
          setConsecutivePerfectDrops(0); // Reset after awarding
          toast({ description: <span className="flex items-center text-sm"><Gem className="h-4 w-4 mr-1 text-sky-400" /> 3x Perfect! +{gainedDiamondsThisDrop.toFixed(2)}💎</span>, duration: 1500, className: "bg-primary/20 border-primary/50" });
        }
      } else {
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP;
        setConsecutivePerfectDrops(0);
      }
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);
      if (gainedDiamondsThisDrop > 0) {
        setCurrentAttemptDiamonds(d => parseFloat((d + gainedDiamondsThisDrop).toFixed(4)));
      }

      if (newBlockWidth < MIN_BLOCK_WIDTH) {
        processAttemptOver(); return;
      }

      const newBlockY = topStackBlock.y - INITIAL_BLOCK_HEIGHT;
      const newStackedBlock: StackedBlock = {
        id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: newBlockY,
        width: newBlockWidth, color: currentBlock.color, isPerfect: isPerfectDrop,
      };
      setStackedBlocks(prev => [...prev, newStackedBlock]);
      
      const visualNewBlockTopY = newBlockY - stackVisualOffsetY;
      if (visualNewBlockTopY < GAME_AREA_HEIGHT_MIN / 2.3 && stackedBlocks.length + 1 > 5) { // +1 because we just added a block
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT);
      }

      spawnNewBlock(newBlockWidth, newBlockY - stackVisualOffsetY); // Spawn based on adjusted Y
      setGameState('playing');

    } else {
      processAttemptOver();
    }
  }, [gameState, currentBlock, stackedBlocks, consecutivePerfectDrops, spawnNewBlock, processAttemptOver, toast, stackVisualOffsetY, isGameApiLoading, gameAreaWidth]);


  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock) {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
      return;
    }
    setCurrentBlock(prev => {
      if (!prev) return null;
      let newX = prev.x + prev.direction * prev.speed;
      let newDirection = prev.direction;
      if (newX + prev.width > gameAreaWidth) {
        newX = gameAreaWidth - prev.width;
        newDirection = -1;
      } else if (newX < 0) {
        newX = 0;
        newDirection = 1;
      }
      return { ...prev, x: newX, direction: newDirection as (1 | -1) };
    });
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, currentBlock, gameAreaWidth]);

  useEffect(() => {
    if (gameState === 'playing' && currentBlock && gameAreaWidth > 0 && !gameLoopRef.current) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState !== 'playing' && gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, gameLoop, currentBlock, gameAreaWidth]);

  const handleWatchAdForHeart = useCallback(async () => {
    if (!currentUser || pooledHearts >= MAX_POOLED_HEARTS || (currentUser.ad_views_today_count || 0) >= (currentUser.daily_ad_views_limit || 50)) {
      if (pooledHearts >= MAX_POOLED_HEARTS) toast({ title: "Hearts Full" });
      else toast({ title: "Daily Ad Limit Reached for Gaining Hearts" });
      return;
    }
    setAdPurpose('gain_pooled_heart');
    setAdTimer(AD_WATCH_DURATION_SECONDS);
    setAdProgress(0);
    setIsAdDialogOpen(true);
    setGameState('ad_viewing');
  }, [currentUser, pooledHearts, toast, gameState]);

  const processAdReward = useCallback(async () => {
    if (!currentUser?.id || adPurpose !== 'gain_pooled_heart' || isGameApiLoading) {
      setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
      setAdPurpose(null);
      return;
    }
    setIsGameApiLoading(true);
    try {
      const res = await fetch('/api/games/watch-ad-for-heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      updateHeartStateFromApi(data, 'processAdReward_watchAdForHeart');
      if (data.success) {
        toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> +1 Heart!</span>, duration: 2000 });
        // updateUserSession for ad_views_today_count is handled by updateHeartStateFromApi
      } else {
        toast({ title: "Ad Reward Failed", description: data.error || "Could not grant heart.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Server Error", description: "Could not verify ad watch.", variant: "destructive" });
    } finally {
      setIsGameApiLoading(false);
      setAdPurpose(null);
      // Game state (idle/waiting_for_hearts) is set by updateHeartStateFromApi after processing response
    }
  }, [currentUser?.id, adPurpose, pooledHearts, toast, updateHeartStateFromApi, isGameApiLoading]);

  useEffect(() => {
    let adViewTimerId: NodeJS.Timeout | undefined;
    if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer > 0) {
      adViewTimerId = setTimeout(() => {
        setAdTimer(prev => prev - 1);
        setAdProgress(prev => Math.min(prev + (100 / AD_WATCH_DURATION_SECONDS), 100));
      }, 1000);
    } else if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer === 0 && adProgress >= 100) {
      setIsAdDialogOpen(false); 
      if (!isGameApiLoading) {
        processAdReward(); 
      }
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adProgress, processAdReward, isGameApiLoading]);

  const closeAdDialogEarly = useCallback(() => {
    setIsAdDialogOpen(false);
    setAdPurpose(null);
    setAdTimer(AD_WATCH_DURATION_SECONDS); setAdProgress(0);
    setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts'); 
    toast({ title: "Ad Closed", description: "No reward granted.", variant: "default", duration: 1500 });
  }, [pooledHearts, toast]);

  const handleSpendDiamondsToContinue = useCallback(async () => {
    if (!currentUser?.id || typeof currentUser.diamond_points !== 'number' || isGameApiLoading) return;
    if (diamondContinuesUsedThisAttempt >= MAX_DIAMOND_CONTINUES_PER_ATTEMPT) {
      toast({ title: "Continue Limit Reached", description: `Max ${MAX_DIAMOND_CONTINUES_PER_ATTEMPT} continues per attempt.`, variant: "default" }); return;
    }
    if (currentUser.diamond_points < DIAMONDS_TO_CONTINUE_ATTEMPT) {
      toast({ title: "Not Enough Diamonds", description: `You need ${DIAMONDS_TO_CONTINUE_ATTEMPT}💎 to continue.`, variant: "destructive" }); return;
    }
    setIsGameApiLoading(true);
    try {
      const response = await fetch('/api/games/spend-diamonds-to-continue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, diamondsToSpend: DIAMONDS_TO_CONTINUE_ATTEMPT })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Failed to use diamonds.");
      
      updateUserSession({ diamond_points: data.newDiamondBalance });
      setDiamondContinuesUsedThisAttempt(prev => prev + 1);
      toast({ description: ( <span className="flex items-center text-sm"> <Gem className="h-4 w-4 mr-1 text-sky-400" /> -{DIAMONDS_TO_CONTINUE_ATTEMPT} Diamond. Go! </span> ), duration: 2000 });
      continueCurrentAttempt();
    } catch (error) {
      toast({ title: "Failed to Continue", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser, diamondContinuesUsedThisAttempt, continueCurrentAttempt, toast, updateUserSession, isGameApiLoading]);


  const canContinueWithDiamonds = currentUser && typeof currentUser.diamond_points === 'number' && currentUser.diamond_points >= DIAMONDS_TO_CONTINUE_ATTEMPT && diamondContinuesUsedThisAttempt < MAX_DIAMOND_CONTINUES_PER_ATTEMPT;
  const adViewsForHeartsToday = currentUser?.ad_views_today_count || 0;
  const dailyAdLimitForHearts = currentUser?.daily_ad_views_limit || 5; // Ensure this is same as defined in API or user type
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS && adViewsForHeartsToday < dailyAdLimitForHearts;
  
  const isReadyToCollectHeartManual = timeToNextHeartDisplay === "Collect Heart" || timeToNextHeartDisplay === "Ready!";
  const isHeartRegenCountdownActive = timeToNextHeartDisplay && timeToNextHeartDisplay !== "Collect Heart" && timeToNextHeartDisplay !== "Ready!" && timeToNextHeartDisplay !== "Hearts Full!";


  if (isInitialLoading || (contextLoadingUser && !currentUser && gameState === 'loading_user_data')) {
    return (
      <AppShell>
        <div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}>
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading Stake Builder...</p>
        </div>
      </AppShell>
    );
  }
  
  return (
    <AppShell>
      <div 
        id="stake-builder-game-page-container" 
        className="flex flex-col flex-grow w-full bg-gradient-to-br from-slate-900 via-purple-950/80 to-slate-900 text-slate-100 overflow-hidden relative" 
        style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}
        onClick={gameState === 'playing' ? handleDropBlock : undefined}
        role="button" 
        tabIndex={gameState === 'playing' ? 0 : -1}
        aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
        onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space' || e.key === 'Enter') && gameState === 'playing') handleDropBlock(); }}
      >
        {/* Top Stats Bar - Always Visible */}
        <div className="w-full px-2 sm:px-4 py-2 bg-slate-900/90 backdrop-blur-sm shadow-md border-b border-primary/30 z-20">
          <div className="flex flex-wrap justify-between items-center max-w-5xl mx-auto gap-y-1 gap-x-2 sm:gap-x-3">
            <div className="flex items-center space-x-1">
              {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                <Heart key={`life-${i}`} className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300 stroke-[1.5px]", i < pooledHearts ? "text-red-500 fill-red-500 animate-pulse [animation-duration:1.5s]" : "text-slate-600 fill-slate-700 stroke-slate-800")} />
              ))}
            </div>
            <div className="flex items-center gap-1 xs:gap-2 text-xs sm:text-sm">
              <span className="flex items-center gap-1 p-1 px-1.5 xs:px-2 bg-slate-700/60 rounded-md shadow"> <Coins className="text-yellow-400 h-3 w-3 xs:h-4 xs:w-4" /> <span className="text-yellow-300 font-semibold tabular-nums">{currentAttemptGold}</span> </span>
              {currentAttemptDiamonds > 0 && (
                <span className="flex items-center gap-1 p-1 px-1.5 xs:px-2 bg-slate-700/60 rounded-md shadow"> <Gem className="text-sky-400 h-3 w-3 xs:h-4 xs:w-4" /> <span className="text-sky-300 font-semibold tabular-nums">{currentAttemptDiamonds.toFixed(2)}</span> </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold flex items-center justify-end gap-1 sm:gap-1.5">
              <Award className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 filter drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]" />
              <span className="text-slate-100 tabular-nums">{stakeBuilderHighScore}</span>
            </p>
          </div>
        </div>

        {/* Main Content Area: Game Canvas or Pre-Game/Post-Game UI */}
        <div className="flex-grow w-full flex flex-col items-center justify-center overflow-hidden p-2 relative">
          {gameState === 'playing' || gameState === 'dropping' ? (
            gameAreaWidth > 0 && (
              <div ref={gameAreaRef} className="relative bg-black/40 border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl shadow-primary/30" style={{ height: `${GAME_AREA_HEIGHT_MIN}px`, width: `${gameAreaWidth}px`, backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.08) 0%, hsl(var(--accent)/0.04) 40%, hsl(var(--background)/0.3) 100%)', cursor: 'pointer', willChange: 'transform' }}>
                <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
                  {stackedBlocks.map(block => (
                    <div key={block.id} className={cn("absolute rounded-sm border", block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50 shadow-[0_0_15px_rgba(250,204,21,0.6)]", block.id === 'base' ? 'border-muted/50' : 'border-border/60')} style={{ left: `${block.x}px`, top: `${block.y}px`, width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`, backgroundColor: block.color, willChange: 'left, top, width', transition: 'all 0.1s linear' }} />
                  ))}
                </div>
                {currentBlock && (
                  <div className="absolute rounded-sm border border-white/40 shadow-lg" style={{ left: `${currentBlock.x}px`, top: `${currentBlock.y}px`, width: `${currentBlock.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`, backgroundColor: currentBlock.color, willChange: 'left, top, width' }} />
                )}
                {gameState === 'playing' && (
                    <p className="text-sm text-center text-foreground/80 py-1.5 flex items-center justify-center gap-1.5 z-20 absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/30 px-3 rounded-full">
                    <MousePointerClick className="h-4 w-4" /> Tap or Press Space
                    </p>
                )}
              </div>
            )
          ) : ( // Pre-Game / Post-Game UI
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-4 max-w-md w-full">
              {gameState === 'gameover_attempt' && (
                <div className="p-4 bg-card/80 rounded-lg shadow-xl border border-primary/30 w-full mb-4">
                  <Award size={48} className="text-yellow-400 mb-2 mx-auto" />
                  <h2 className="text-2xl font-bold text-slate-100 font-headline">Attempt Over!</h2>
                  <p className="text-lg">Score: <span className="font-bold text-slate-100">{stackedBlocks.length - 1}</span></p>
                  <p className="text-md text-yellow-400 flex items-center justify-center gap-1"><Coins className="inline h-4 w-4" />{currentAttemptGold}</p>
                  {currentAttemptDiamonds > 0 && <p className="text-md text-sky-400 flex items-center justify-center gap-1"><Gem className="inline h-4 w-4" />{currentAttemptDiamonds.toFixed(2)}</p>}
                  {canContinueWithDiamonds && (
                    <Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400/10 mt-3">
                      {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />}
                      Use {DIAMONDS_TO_CONTINUE_ATTEMPT}💎 to Continue ({MAX_DIAMOND_CONTINUES_PER_ATTEMPT - diamondContinuesUsedThisAttempt} left)
                    </Button>
                  )}
                </div>
              )}
              
              {/* Always visible action buttons when not playing */}
              <Button onClick={startGameAttempt} disabled={isGameApiLoading || pooledHearts <= 0 || gameState === 'playing' || gameState === 'ad_viewing'} size="lg" className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-xl py-3 rounded-lg shadow-xl transform hover:scale-105">
                {isGameApiLoading && !(gameState === 'playing' || gameState === 'ad_viewing') && pooledHearts > 0 ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-3 h-6 w-6" />}
                {isGameApiLoading && pooledHearts > 0 ? "Starting..." : (pooledHearts > 0 ? `Play Game (-1 Heart)` : "No Hearts Left")}
              </Button>

              {/* Heart Management Area */}
              <div className="w-full p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                {isInitialLoading && gameState === 'loading_user_data' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                ) : pooledHearts >= MAX_POOLED_HEARTS ? (
                    <p className="text-sm text-green-400 font-semibold flex items-center justify-center gap-1.5"><CheckCircle className="h-4 w-4"/> {timeToNextHeartDisplay || "Hearts Full!"}</p>
                ) : isHeartRegenCountdownActive ? (
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Next Heart In:</p>
                        <p className="text-lg font-semibold font-mono text-yellow-300">{timeToNextHeartDisplay}</p>
                        <Button onClick={attemptHeartReplenish} disabled={true} variant="outline" size="sm" className="w-full mt-1 opacity-60 cursor-not-allowed">
                            Waiting...
                        </Button>
                    </div>
                ) : isReadyToCollectHeartManual ? (
                     <Button onClick={attemptHeartReplenish} disabled={isGameApiLoading} variant="outline" className="w-full border-green-500 text-green-400 hover:bg-green-500/10">
                        {isGameApiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/> }
                        Collect Heart
                    </Button>
                ) : ( <p className="text-sm text-slate-400">Checking heart status...</p> )}
              </div>
            
              {canWatchAdForPooledHeart && (
                <Button onClick={handleWatchAdForHeart} disabled={isGameApiLoading || isAdDialogOpen} variant="outline" size="md" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 transition-colors duration-200 ease-in-out shadow-md">
                  <Tv className="mr-2 h-4 w-4" /> Watch Ad for +1 <Heart className="inline h-3 w-3 fill-current ml-1 text-red-400" />
                </Button>
              )}
              { (gameState === 'idle' || gameState === 'waiting_for_hearts' || gameState === 'gameover_attempt') && <p className="text-xs text-muted-foreground mt-3">Tap screen or press Space to drop blocks. Perfect drops earn more!</p> }
            </div>
          )}
        </div>

        {isAdDialogOpen && (
          <Dialog open={isAdDialogOpen} onOpenChange={(open) => { if (!open && gameState === 'ad_viewing') closeAdDialogEarly() }}>
            <DialogContent className="sm:max-w-xs bg-slate-800/95 backdrop-blur-md border-slate-700 text-slate-100 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-yellow-300 text-lg"><Tv className="h-5 w-5" /> Simulated Ad</DialogTitle>
                <DialogDescription className="text-slate-400 text-sm">Reward: +1 <Heart className="inline h-3 w-3 text-red-400 fill-red-400" />.</DialogDescription>
              </DialogHeader>
              <div className="py-4 text-center space-y-3">
                <div className="w-full h-32 sm:h-40 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden border border-slate-600">
                  <Image src="https://placehold.co/280x140/1f2937/4b5563.png?text=Ad+Playing..." alt="Simulated Ad Content" width={280} height={140} data-ai-hint="advertisement video" className="object-cover" />
                </div>
                <Progress value={adProgress} className="w-full h-2 bg-slate-600 border border-slate-500 [&>div]:bg-yellow-400" />
                <p className="text-4xl font-bold text-yellow-300 tabular-nums">{adTimer}s</p>
              </div>
              <DialogFooter>
                <Button onClick={closeAdDialogEarly} variant="destructive" size="sm" className="w-full opacity-80 hover:opacity-100" disabled={adProgress >= 100 && adTimer === 0}>
                  Close Ad (No Reward)
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppShell>
  );
}

    