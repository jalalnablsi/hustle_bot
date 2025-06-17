
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Heart, Play, Tv, Gamepad2, AlertTriangle, Info, Coins, Gem, Loader2, MousePointerClick, Award, Star, RefreshCw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { useUser } from '@/contexts/UserContext';

// Module-level constants (if any are truly needed here, e.g., for export or use by other server logic)
const GAME_TYPE_IDENTIFIER = 'stake-builder'; // Example: might be used elsewhere
const MAX_POOLED_HEARTS = 5; // Often used in UI logic outside direct game mechanics

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

const HEADER_HEIGHT_CSS_VAR = 'var(--header-height, 64px)';
const BOTTOM_NAV_HEIGHT_CSS_VAR = 'var(--bottom-nav-height, 64px)';


export default function StakeBuilderGamePage() {
  // Game-specific constants moved inside the component scope
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
  const AD_WATCH_DURATION_SECONDS_INTERNAL = 5;

  const BLOCK_COLORS_INTERNAL = [
    'hsl(var(--chart-1)/0.9)', 'hsl(var(--chart-2)/0.9)', 'hsl(var(--chart-3)/0.9)',
    'hsl(var(--chart-4)/0.9)', 'hsl(var(--chart-5)/0.9)',
    'hsl(var(--accent)/0.8)', 'hsl(var(--primary)/0.8)', 'hsl(var(--secondary)/0.8)',
  ];

  const BLOCK_SLIDE_SPEED_START_INTERNAL = 1.8; // Slightly increased
  const BLOCK_SLIDE_SPEED_INCREMENT_BASE_INTERNAL = 0.035; // Slightly increased
  const BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR_INTERNAL = 0.0007;
  const MAX_BLOCK_SLIDE_SPEED_INTERNAL = 6.5;
  const PERFECT_DROP_THRESHOLD_INTERNAL = 2.5;

  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();
  const [isGameApiLoading, setIsGameApiLoading] = useState(false);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);

  const [gameState, setGameState] = useState<'loading_user_data' | 'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts'>('loading_user_data');
  const [gameInitializationPending, setGameInitializationPending] = useState(false);

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

  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(AD_WATCH_DURATION_SECONDS_INTERNAL);
  const [adProgress, setAdProgress] = useState(0);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const { toast } = useToast();

  const [gameAreaWidth, setGameAreaWidth] = useState(0);

  const getGameAreaWidth = useCallback(() => {
    if (typeof window !== 'undefined') {
      const gamePageContainer = document.getElementById('stake-builder-game-page-container');
      if (gamePageContainer) {
        const padding = 16; 
        let calculatedWidth = gamePageContainer.clientWidth - padding * 2;
        calculatedWidth = Math.min(calculatedWidth, GAME_AREA_WIDTH_BASE_INTERNAL + 100); 
        return Math.max(MIN_BLOCK_WIDTH_INTERNAL * 10, calculatedWidth);
      }
      return Math.max(MIN_BLOCK_WIDTH_INTERNAL * 10, window.innerWidth * 0.90);
    }
    return GAME_AREA_WIDTH_BASE_INTERNAL;
  }, [GAME_AREA_WIDTH_BASE_INTERNAL, MIN_BLOCK_WIDTH_INTERNAL]); // Add internal constants if they are used

  useEffect(() => {
    const handleResize = () => {
      const newWidth = getGameAreaWidth();
      if (newWidth > 0) setGameAreaWidth(newWidth);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize(); 
    }
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize);
    };
  }, [getGameAreaWidth]);

  const updateHeartStateFromApi = useCallback((apiData: any, source: string) => {
    if (!apiData) {
      console.warn("updateHeartStateFromApi called with null/undefined apiData from source:", source);
      return false;
    }

    let newHeartsCount = -1;
    let newNextRegenTimestampStr: string | null = null;
    let heartsUpdated = false;

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
        updateUserSession({ ad_views_today_count: apiData.adViewsToday });
      }
      heartsUpdated = true;
    } else if (!apiData.success && apiData.message === 'Not ready to replenish hearts yet.' && apiData.nextReplenish) {
      newHeartsCount = pooledHearts; 
      newNextRegenTimestampStr = apiData.nextReplenish;
      if (source === 'checkBackendReplenish_manual_collect') {
        toast({ title: "Hearts Not Ready", description: "Not time to collect new hearts yet. Timer updated.", variant: "default" });
      }
      heartsUpdated = true;
    } else {
      if (apiData.error && source !== 'fetchInitialHeartStatus_api_hearts') {
        toast({ title: 'Heart Sync Issue', description: `${apiData.error || 'Unknown error'} (Source: ${source || 'Unknown'})`, variant: "destructive" });
      }
      if (source === 'fetchInitialHeartStatus_api_hearts' && !apiData.success) {
        console.warn("Initial heart fetch from /api/games/hearts failed. Will rely on UserContext or set defaults.");
      }
      return false; 
    }

    if (newHeartsCount !== -1) {
      setPooledHearts(Math.min(newHeartsCount, MAX_POOLED_HEARTS));
    }

    if (newNextRegenTimestampStr) {
      const regenTime = new Date(newNextRegenTimestampStr).getTime();
      const currentHeartLevel = newHeartsCount !== -1 ? newHeartsCount : pooledHearts;
      if (currentHeartLevel < MAX_POOLED_HEARTS) { 
          setNextHeartRegenTime(regenTime > Date.now() ? regenTime : null);
      } else {
           setNextHeartRegenTime(null); 
      }
    } else if (newHeartsCount >= MAX_POOLED_HEARTS || pooledHearts >= MAX_POOLED_HEARTS) {
      setNextHeartRegenTime(null);
    }
    return heartsUpdated;
  }, [currentUser, pooledHearts, updateUserSession, toast, GAME_TYPE_IDENTIFIER]); // Added GAME_TYPE_IDENTIFIER

  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime && nextHeartRegenTime > Date.now()) {
      const updateTimerDisplay = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          setTimeToNextHeartDisplay("Collect Heart");
          if (intervalId) clearInterval(intervalId);
        } else {
          const remainingMs = nextHeartRegenTime - now;
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
          setTimeToNextHeartDisplay(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      };
      updateTimerDisplay();
      intervalId = setInterval(updateTimerDisplay, 1000);
    } else if (pooledHearts < MAX_POOLED_HEARTS && (!nextHeartRegenTime || nextHeartRegenTime <= Date.now())) {
      setTimeToNextHeartDisplay("Collect Heart");
    } else if (pooledHearts >= MAX_POOLED_HEARTS) {
      setTimeToNextHeartDisplay("Hearts Full!");
    } else {
      setTimeToNextHeartDisplay("Loading...");
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime]);

  const fetchUserGameData = useCallback(async (userIdForFetch: string) => {
    if (!userIdForFetch) return;
    setIsInitialDataLoading(true);
    setIsGameApiLoading(true);
    try {
      const highScoreRes = await fetch(`/api/games/high-scores?userId=${userIdForFetch}&gameType=${GAME_TYPE_IDENTIFIER}`);
      if (highScoreRes.ok) {
        const highScoreData = await highScoreRes.json();
        if (highScoreData.success) setStakeBuilderHighScore(highScoreData.highScore || 0);
      } else console.warn("Failed to fetch high score.");

      const heartsRes = await fetch(`/api/games/hearts`); 
      const heartsApiData = await heartsRes.json();
      
      const heartsUpdated = updateHeartStateFromApi(heartsApiData, 'fetchInitialHeartStatus_api_hearts');
      
      if (heartsUpdated && heartsApiData.success) {
         const initialHearts = heartsApiData.hearts?.[GAME_TYPE_IDENTIFIER] ?? 0;
         setGameState(initialHearts > 0 ? 'idle' : 'waiting_for_hearts');
      } else {
        const contextHearts = currentUser?.game_hearts?.[GAME_TYPE_IDENTIFIER]?.count ?? 0;
        const contextNextRegen = currentUser?.game_hearts?.[GAME_TYPE_IDENTIFIER]?.nextRegen;
        
        setPooledHearts(contextHearts);
        if (contextNextRegen) {
            const regenTime = new Date(contextNextRegen).getTime();
            if (contextHearts < MAX_POOLED_HEARTS) {
                setNextHeartRegenTime(regenTime > Date.now() ? regenTime : null);
            } else {
                setNextHeartRegenTime(null);
            }
        } else {
            setNextHeartRegenTime(null);
        }
        setGameState(contextHearts > 0 ? 'idle' : 'waiting_for_hearts');
        console.warn("Initial /api/games/hearts fetch failed. Using UserContext data or defaults for hearts.");
      }

    } catch (error) {
      toast({ title: 'Error Loading Game Data', description: "Could not load initial game details. Please refresh.", variant: 'destructive' });
      setGameState('waiting_for_hearts'); 
      setPooledHearts(0); 
      setNextHeartRegenTime(null);
    } finally {
      setIsInitialDataLoading(false);
      setIsGameApiLoading(false);
    }
  }, [toast, updateHeartStateFromApi, currentUser, GAME_TYPE_IDENTIFIER]); // Added GAME_TYPE_IDENTIFIER

  const checkBackendReplenish = useCallback(async (isManualCollectAttempt = false) => {
    if (!currentUser?.id || isGameApiLoading) return;
    if (isManualCollectAttempt && pooledHearts >= MAX_POOLED_HEARTS) {
      toast({ title: "Hearts Full", description: "You already have the maximum hearts." });
      return;
    }
    setIsGameApiLoading(true);
    if (isManualCollectAttempt) {
      toast({ description: "Trying to collect heart...", duration: 2000, icon: <RefreshCw className="h-4 w-4 animate-spin" /> });
    }
    try {
      const res = await fetch('/api/games/replenish-hearts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      const previousHearts = pooledHearts;
      const heartsUpdated = updateHeartStateFromApi(data, isManualCollectAttempt ? 'checkBackendReplenish_manual_collect' : 'checkBackendReplenish_auto');

      if (isManualCollectAttempt && heartsUpdated && data.success) {
        const newHearts = (data.hearts && typeof data.hearts === 'object' && data.hearts[GAME_TYPE_IDENTIFIER] !== undefined)
          ? data.hearts[GAME_TYPE_IDENTIFIER]
          : previousHearts; 

        if (newHearts > previousHearts) {
          toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> Heart(s) collected! New total: {newHearts}</span>, duration: 2500 });
        }
      }
      if (heartsUpdated && gameState !== 'playing' && gameState !== 'dropping' && gameState !== 'ad_viewing' && gameState !== 'gameover_attempt') {
        const currentHeartCount = (data.success && data.hearts?.[GAME_TYPE_IDENTIFIER] !== undefined) ? data.hearts[GAME_TYPE_IDENTIFIER] : pooledHearts;
        setGameState(currentHeartCount > 0 ? 'idle' : 'waiting_for_hearts');
      }
    } catch (error) {
      console.error('Error during heart replenish check:', error);
      if (isManualCollectAttempt) toast({ title: "Network Error", description: "Failed to collect heart.", variant: "destructive" })
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, updateHeartStateFromApi, isGameApiLoading, pooledHearts, toast, gameState, GAME_TYPE_IDENTIFIER]); // Added GAME_TYPE_IDENTIFIER

  useEffect(() => {
    if (currentUser?.id && gameState === 'loading_user_data') {
      fetchUserGameData(currentUser.id);
    } else if (!contextLoadingUser && !currentUser && gameState === 'loading_user_data') {
      setIsInitialDataLoading(false);
      setGameState('idle'); 
      setPooledHearts(0);
      setNextHeartRegenTime(null);
       toast({ title: "User Not Logged In", description: "Please ensure you are logged in via Telegram.", variant: "destructive" });
    }
  }, [currentUser, contextLoadingUser, fetchUserGameData, gameState, toast]);

  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number) => {
    if (!gameAreaRef.current || gameAreaWidth <= 0) {
        console.warn("spawnNewBlock: Game area not ready or invalid width", { hasRef: !!gameAreaRef.current, gameAreaWidth });
        return;
    }
    const currentScore = Math.max(0, stackedBlocks.length - 1);
    const speedRamp = currentScore * BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR_INTERNAL;
    const speedIncrement = BLOCK_SLIDE_SPEED_INCREMENT_BASE_INTERNAL + speedRamp;
    const currentSpeed = Math.min(BLOCK_SLIDE_SPEED_START_INTERNAL + (currentScore * speedIncrement), MAX_BLOCK_SLIDE_SPEED_INTERNAL);

    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 - currentTopWidth / 4 : gameAreaWidth - currentTopWidth * 3 / 4,
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT_INTERNAL - 5,
      width: currentTopWidth,
      color: BLOCK_COLORS_INTERNAL[stackedBlocks.length % BLOCK_COLORS_INTERNAL.length],
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: Math.max(0.5, currentSpeed),
    });
  }, [gameAreaWidth, stackedBlocks.length, BLOCK_COLORS_INTERNAL, BLOCK_SLIDE_SPEED_INCREMENT_BASE_INTERNAL, BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR_INTERNAL, BLOCK_SLIDE_SPEED_START_INTERNAL, INITIAL_BLOCK_HEIGHT_INTERNAL, MAX_BLOCK_SLIDE_SPEED_INTERNAL]); // Include internal constants

  const initializeNewGameAttempt = useCallback(() => {
    if (!gameAreaRef.current || gameAreaWidth <= 0) {
      console.error("Cannot initialize game: Game area not ready or invalid width.", { hasRef: !!gameAreaRef.current, gameAreaWidth });
      setGameState('idle');
      toast({ title: "Game Area Error", description: "Could not initialize game area. Please ensure the screen is ready and try again.", variant: "destructive" });
      setGameInitializationPending(false);
      return;
    }

    setCurrentAttemptGold(0);
    setCurrentAttemptDiamonds(0);
    setConsecutivePerfectDrops(0);
    setDiamondContinuesUsedThisAttempt(0);
    setStackVisualOffsetY(0);

    const baseBlockX = (gameAreaWidth - INITIAL_BASE_WIDTH_INTERNAL) / 2;
    const baseBlock: StackedBlock = {
      id: 'base', x: baseBlockX,
      y: GAME_AREA_HEIGHT_MIN_INTERNAL - INITIAL_BLOCK_HEIGHT_INTERNAL,
      width: INITIAL_BASE_WIDTH_INTERNAL, color: 'hsl(var(--muted))',
    };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y);
    setGameState('playing');
  }, [gameAreaWidth, spawnNewBlock, toast, GAME_AREA_HEIGHT_MIN_INTERNAL, INITIAL_BASE_WIDTH_INTERNAL, INITIAL_BLOCK_HEIGHT_INTERNAL]); // Include internal constants

  useEffect(() => {
    if (gameInitializationPending && gameAreaWidth > 0 && gameAreaRef.current) {
      initializeNewGameAttempt();
      setGameInitializationPending(false);
    } else if (gameInitializationPending && (gameAreaWidth <= 0 || !gameAreaRef.current)) {
      console.warn("Game initialization pending, but game area not ready. Width:", gameAreaWidth, "Ref:", gameAreaRef.current);
    }
  }, [gameInitializationPending, gameAreaWidth, initializeNewGameAttempt]);

  const startGameAttempt = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: "Login Required", description: "Please log in to play.", variant: "destructive" }); return;
    }
    if (pooledHearts <= 0 || isGameApiLoading || gameState === 'playing' || gameState === 'ad_viewing' || gameAreaWidth <= 0) {
      if (pooledHearts <= 0 && gameState !== 'playing') toast({ title: "No Hearts Left!", description: "Replenish hearts or watch an ad." });
      else if (gameAreaWidth <= 0 && pooledHearts > 0) toast({ title: "Game Area Not Ready", description: "Please wait a moment for the game area to initialize." });
      else if (isGameApiLoading) toast({ title: "Busy", description: "Please wait, an operation is in progress."});
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
        if (data.error?.toLowerCase().includes("no hearts")) {
          setPooledHearts(0); 
          setGameState('waiting_for_hearts');
        }
      } else {
        updateHeartStateFromApi(data, 'startGameAttempt_useHeart');
        setGameInitializationPending(true); 
      }
    } catch (error) {
      toast({ title: 'Network Error', description: "Could not start game.", variant: 'destructive' });
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, pooledHearts, toast, gameState, updateHeartStateFromApi, isGameApiLoading, gameAreaWidth, GAME_TYPE_IDENTIFIER]); // Added GAME_TYPE_IDENTIFIER

  const processAttemptOver = useCallback(async () => {
    const finalScore = Math.max(0, stackedBlocks.length - 1);
    setGameState('gameover_attempt');

    const finalGold = currentAttemptGold;
    const finalDiamonds = currentAttemptDiamonds;

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    gameLoopRef.current = null;
    setCurrentBlock(null);

    if (currentUser?.id && (finalScore > 0 || finalGold > 0 || finalDiamonds > 0)) {
      setIsGameApiLoading(true); 
      try {
        const scoreRes = await fetch('/api/games/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER,
            score: finalScore, goldEarned: finalGold, diamondEarned: finalDiamonds,
          }),
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
             toast({ title: "Score Saved!", description: `Score: ${finalScore}, Gold: ${finalGold.toFixed(0)}, Diamonds: ${finalDiamonds.toFixed(2)}`});
          }
        } else {
          toast({ title: "Score Submission Issue", description: scoreData.error || "Could not save score.", variant: "destructive" });
        }
      } catch (error) {
        toast({ title: "Network Error", description: "Score submission failed: " + (error as Error).message, variant: "destructive" });
      } finally {
        setIsGameApiLoading(false);
      }
    }
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, stakeBuilderHighScore, updateUserSession, toast, GAME_TYPE_IDENTIFIER]); // Added GAME_TYPE_IDENTIFIER

  const continueCurrentAttempt = useCallback(() => {
    if (stackedBlocks.length > 0 && gameAreaWidth > 0) {
      const topBlock = stackedBlocks[stackedBlocks.length - 1];
      spawnNewBlock(topBlock.width, topBlock.y - stackVisualOffsetY);
      setGameState('playing');
    } else if (gameAreaWidth <= 0) {
        toast({ title: "Game Area Error", description: "Cannot continue, game area not ready.", variant: "destructive" });
        setGameState('idle');
    } else {
      setGameInitializationPending(true); 
    }
  }, [stackedBlocks, spawnNewBlock, stackVisualOffsetY, gameAreaWidth, toast]);

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

    if (overlapWidth >= MIN_BLOCK_WIDTH_INTERNAL * 0.7) { 
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      const xDiff = Math.abs(currentBlock.x - topStackBlock.x);
      const widthDiff = Math.abs(currentBlock.width - topStackBlock.width);

      if (xDiff < PERFECT_DROP_THRESHOLD_INTERNAL && widthDiff < PERFECT_DROP_THRESHOLD_INTERNAL + 2) { 
        isPerfectDrop = true;
        newBlockX = topStackBlock.x; 
        newBlockWidth = topStackBlock.width; 
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP_INTERNAL;
        const newConsecutivePerfects = consecutivePerfectDrops + 1;
        setConsecutivePerfectDrops(newConsecutivePerfects);
        if (newConsecutivePerfects >= 3) {
          gainedDiamondsThisDrop = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS_INTERNAL;
          setConsecutivePerfectDrops(0); 
          toast({ description: <span className="flex items-center text-sm"><Gem className="h-4 w-4 mr-1 text-sky-400" /> 3x Perfect! +{gainedDiamondsThisDrop.toFixed(2)}💎</span>, duration: 1500, className: "bg-primary/20 border-primary/50" });
        }
      } else {
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP_INTERNAL;
        setConsecutivePerfectDrops(0); 
      }
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);
      if (gainedDiamondsThisDrop > 0) {
         setCurrentAttemptDiamonds(d => parseFloat((d + gainedDiamondsThisDrop).toFixed(4)));
      }

      if (newBlockWidth < MIN_BLOCK_WIDTH_INTERNAL) {
        processAttemptOver(); return;
      }

      const newBlockY = topStackBlock.y - INITIAL_BLOCK_HEIGHT_INTERNAL;
      const newStackedBlock: StackedBlock = {
        id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: newBlockY,
        width: newBlockWidth, color: currentBlock.color, isPerfect: isPerfectDrop,
      };
      setStackedBlocks(prev => [...prev, newStackedBlock]);

      const visualNewBlockTopY = newBlockY - stackVisualOffsetY;
      if (visualNewBlockTopY < GAME_AREA_HEIGHT_MIN_INTERNAL / 2.3 && stackedBlocks.length +1 > 5) { 
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT_INTERNAL);
      }
      
      if (gameAreaWidth > 0) {
          spawnNewBlock(newBlockWidth, newBlockY - stackVisualOffsetY); 
          setGameState('playing'); 
      } else {
          processAttemptOver(); 
      }

    } else { 
      processAttemptOver();
    }
  }, [gameState, currentBlock, stackedBlocks, consecutivePerfectDrops, spawnNewBlock, processAttemptOver, toast, stackVisualOffsetY, isGameApiLoading, gameAreaWidth, GAME_AREA_HEIGHT_MIN_INTERNAL, INITIAL_BLOCK_HEIGHT_INTERNAL, MIN_BLOCK_WIDTH_INTERNAL, PERFECT_DROP_THRESHOLD_INTERNAL, GOLD_FOR_PERFECT_DROP_INTERNAL, DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS_INTERNAL, GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP_INTERNAL]); // Include internal constants

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock || gameAreaWidth <= 0 || !currentBlock.speed || currentBlock.speed <= 0) {
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
    if (gameState === 'playing' && currentBlock && gameAreaWidth > 0 && currentBlock.speed > 0 && !gameLoopRef.current) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if ((gameState !== 'playing' || !currentBlock || (currentBlock && currentBlock.speed <=0)) && gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, gameLoop, currentBlock, gameAreaWidth]);

  const handleWatchAdForHeart = useCallback(async () => {
    if (!currentUser || pooledHearts >= MAX_POOLED_HEARTS || (currentUser.ad_views_today_count || 0) >= (currentUser.daily_ad_views_limit || 50)) {
      if (pooledHearts >= MAX_POOLED_HEARTS) toast({ title: "Hearts Full", description: "You cannot hold more hearts." });
      else toast({ title: "Daily Ad Limit Reached", description: "You've watched the max ads for hearts today."});
      return;
    }
    setAdTimer(AD_WATCH_DURATION_SECONDS_INTERNAL);
    setAdProgress(0);
    setIsAdDialogOpen(true);
    setGameState('ad_viewing');
  }, [currentUser, pooledHearts, toast, AD_WATCH_DURATION_SECONDS_INTERNAL]); // Include internal constant

  const processAdReward = useCallback(async () => {
    setIsAdDialogOpen(false);
    if (!currentUser?.id || isGameApiLoading) {
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
        setAdTimer(AD_WATCH_DURATION_SECONDS_INTERNAL); setAdProgress(0);
        return;
    }

    setIsGameApiLoading(true);
    toast({ description: "Verifying ad watch...", duration: 1500, icon: <Loader2 className="h-4 w-4 animate-spin"/> });
    try {
        const res = await fetch('/api/games/watch-ad-for-heart', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id }),
        });
        const data = await res.json();

        if (data.success) {
            const heartsWereActuallyUpdated = updateHeartStateFromApi(data, 'processAdReward_watchAdForHeart');
            
            if (heartsWereActuallyUpdated) { 
                toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> +1 Heart!</span>, duration: 2000 });
            } else if (data.hearts && data.hearts[GAME_TYPE_IDENTIFIER] !== undefined) {
                setPooledHearts(Math.min(data.hearts[GAME_TYPE_IDENTIFIER], MAX_POOLED_HEARTS));
                 if (data.adViewsToday !== undefined) updateUserSession({ ad_views_today_count: data.adViewsToday });
                toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> +1 Heart!</span>, duration: 2000 });
            } else {
                 toast({ title: "Ad Reward Note", description: "Heart status may not have changed or API response was unclear.", variant: "default" });
            }
            setGameState(pooledHearts > 0 || (data.hearts && data.hearts[GAME_TYPE_IDENTIFIER] > 0) ? 'idle' : 'waiting_for_hearts');
        } else {
            toast({ title: "Ad Reward Failed", description: data.error || "Could not grant heart.", variant: "destructive" });
            setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
        }
    } catch (error) {
        toast({ title: "Server Error", description: "Could not verify ad watch.", variant: "destructive" });
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    } finally {
        setIsGameApiLoading(false);
        setAdTimer(AD_WATCH_DURATION_SECONDS_INTERNAL);
        setAdProgress(0);
    }
  }, [currentUser?.id, isGameApiLoading, pooledHearts, toast, updateHeartStateFromApi, updateUserSession, AD_WATCH_DURATION_SECONDS_INTERNAL, GAME_TYPE_IDENTIFIER]); // Include internal constants

  useEffect(() => {
    let adViewTimerId: NodeJS.Timeout | undefined;
    if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer > 0) {
      adViewTimerId = setTimeout(() => {
        setAdTimer(prev => prev - 1);
        setAdProgress(prev => Math.min(prev + (100 / AD_WATCH_DURATION_SECONDS_INTERNAL), 100));
      }, 1000);
    } else if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer === 0 && adProgress >= 100) {
      if (!isGameApiLoading) {
          processAdReward();
      }
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adProgress, processAdReward, isGameApiLoading, AD_WATCH_DURATION_SECONDS_INTERNAL]); // Include internal constant

  const closeAdDialogEarly = useCallback(() => {
    setIsAdDialogOpen(false);
    setAdTimer(AD_WATCH_DURATION_SECONDS_INTERNAL); setAdProgress(0);
    setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    toast({ title: "Ad Closed", description: "No reward granted.", variant: "default", duration: 1500 });
  }, [pooledHearts, toast, AD_WATCH_DURATION_SECONDS_INTERNAL]); // Include internal constant

  const handleSpendDiamondsToContinue = useCallback(async () => {
    if (!currentUser?.id || typeof currentUser.diamond_points !== 'number' || isGameApiLoading) return;
    if (diamondContinuesUsedThisAttempt >= MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL) {
      toast({ title: "Continue Limit Reached", description: `Max ${MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL} continues per attempt.`, variant: "default" }); return;
    }
    if (currentUser.diamond_points < DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL) {
      toast({ title: "Not Enough Diamonds", description: `You need ${DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL}💎 to continue.`, variant: "destructive" }); return;
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
    } catch (error) {
      toast({ title: "Failed to Continue", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser, diamondContinuesUsedThisAttempt, continueCurrentAttempt, toast, updateUserSession, isGameApiLoading, DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL, MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL]); // Include internal constants

  const canContinueWithDiamonds = currentUser && typeof currentUser.diamond_points === 'number' && currentUser.diamond_points >= DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL && diamondContinuesUsedThisAttempt < MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL;
  const adViewsForHeartsToday = currentUser?.ad_views_today_count || 0;
  const dailyAdLimitForHearts = currentUser?.daily_ad_views_limit || 50;
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS && adViewsForHeartsToday < dailyAdLimitForHearts;

  const isHeartRegenCountdownActive = timeToNextHeartDisplay && !timeToNextHeartDisplay.includes("Collect") && !timeToNextHeartDisplay.includes("Full") && !timeToNextHeartDisplay.includes("Loading");
  const isReadyToCollectHeartManual = timeToNextHeartDisplay === "Collect Heart" && pooledHearts < MAX_POOLED_HEARTS;
  
  const playButtonDisabled = pooledHearts <= 0 || isGameApiLoading || gameState === 'playing' || gameState === 'ad_viewing' || gameAreaWidth <= 0 || gameInitializationPending;
  let playButtonText = `Play Game (-1 ${HeartIconPlain(true)})`;
  if (isGameApiLoading && pooledHearts > 0 && gameState !== 'playing') playButtonText = "Preparing...";
  else if (gameInitializationPending) playButtonText = "Initializing...";
  else if (gameAreaWidth <= 0 && pooledHearts > 0) playButtonText = "Area Loading...";
  else if (pooledHearts <= 0) playButtonText = "No Hearts Left";

  const HeartIconPlain = (inline = false) => <Heart className={cn("inline h-4 w-4 text-red-400 fill-red-400", inline ? "mx-0.5" : "mr-1")} />;


  if (isInitialDataLoading || (contextLoadingUser && !currentUser && gameState === 'loading_user_data')) {
    return (
      <AppShell>
        <div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}>
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading Stake Builder...</p>
        </div>
      </AppShell>
    );
  }
  
  if (!currentUser && !contextLoadingUser) { 
     return (
      <AppShell>
        <div id="stake-builder-game-page-container" className="flex flex-col flex-grow w-full items-center justify-center text-center p-4" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}>
            <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
            <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
            <p className="text-muted-foreground">Please launch the app via Telegram to play.</p>
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

        <div className="flex-grow w-full flex flex-col items-center justify-center overflow-hidden p-2 relative">
          {(gameState === 'playing' || gameState === 'dropping') && gameAreaWidth > 0 && stackedBlocks.length > 0 ? (
            <div ref={gameAreaRef} className="relative bg-black/40 border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl shadow-primary/30" style={{ height: `${GAME_AREA_HEIGHT_MIN_INTERNAL}px`, width: `${gameAreaWidth}px`, backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.08) 0%, hsl(var(--accent)/0.04) 40%, hsl(var(--background)/0.3) 100%)', cursor: 'pointer', willChange: 'transform' }}>
              <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
                {stackedBlocks.map(block => (
                  <div key={block.id} className={cn("absolute rounded-sm border", block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50 shadow-[0_0_15px_rgba(250,204,21,0.6)]", block.id === 'base' ? 'border-muted/50' : 'border-border/60')} style={{ left: `${block.x}px`, top: `${block.y}px`, width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT_INTERNAL}px`, backgroundColor: block.color, willChange: 'left, top, width', transition: 'all 0.1s linear' }} />
                ))}
              </div>
              {currentBlock && (
                <div className="absolute rounded-sm border border-white/40 shadow-lg" style={{ left: `${currentBlock.x}px`, top: `${currentBlock.y}px`, width: `${currentBlock.width}px`, height: `${INITIAL_BLOCK_HEIGHT_INTERNAL}px`, backgroundColor: currentBlock.color, willChange: 'left, top, width' }} />
              )}
              {gameState === 'playing' && (
                  <p className="text-sm text-center text-foreground/80 py-1.5 flex items-center justify-center gap-1.5 z-20 absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/30 px-3 rounded-full">
                  <MousePointerClick className="h-4 w-4" /> Tap or Press Space
                  </p>
              )}
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
                  {canContinueWithDiamonds && (
                    <Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400/10 mt-3">
                      {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />}
                      Use {DIAMONDS_TO_CONTINUE_ATTEMPT_INTERNAL}💎 to Continue ({MAX_DIAMOND_CONTINUES_PER_ATTEMPT_INTERNAL - diamondContinuesUsedThisAttempt} left)
                    </Button>
                  )}
                </div>
              )}

              <Button onClick={startGameAttempt} disabled={playButtonDisabled} size="lg" className={cn("w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-xl py-3 rounded-lg shadow-xl transform hover:scale-105 transition-transform", playButtonDisabled && "opacity-50 cursor-not-allowed")}>
                {(isGameApiLoading && pooledHearts > 0 && gameState !== 'playing') || gameInitializationPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-3 h-6 w-6" />}
                {playButtonText}
              </Button>
              
              <div className="w-full p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                 {isInitialDataLoading && timeToNextHeartDisplay === "Loading..." && pooledHearts < MAX_POOLED_HEARTS ? (
                    <div className="flex justify-center items-center py-1"><Loader2 className="h-5 w-5 animate-spin text-slate-400"/> <span className="ml-2 text-sm text-slate-400">Heart status...</span></div>
                ) : pooledHearts >= MAX_POOLED_HEARTS ? (
                    <p className="text-sm text-green-400 font-semibold flex items-center justify-center gap-1.5"><CheckCircle className="h-4 w-4"/> Hearts Full!</p>
                ) : isHeartRegenCountdownActive ? (
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">Next {HeartIconPlain()} In:</p>
                        <p className="text-lg font-semibold font-mono text-yellow-300">{timeToNextHeartDisplay}</p>
                         <Button variant="outline" size="sm" className="w-full mt-1 opacity-60 cursor-not-allowed" disabled>
                            Waiting...
                        </Button>
                    </div>
                ) : isReadyToCollectHeartManual ? (
                     <Button onClick={() => checkBackendReplenish(true)} disabled={isGameApiLoading} variant="outline" className="w-full border-green-500 text-green-400 hover:bg-green-500/10">
                        {isGameApiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/> }
                        Collect Heart
                    </Button>
                ) : ( <p className="text-sm text-slate-400 text-center">{timeToNextHeartDisplay === "Loading..." ? <Loader2 className="inline h-4 w-4 animate-spin"/> : "Check heart status or wait."}</p> )}
              </div>

              {canWatchAdForPooledHeart && (
                <Button onClick={handleWatchAdForHeart} disabled={isGameApiLoading || isAdDialogOpen} variant="outline" size="md" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 transition-colors duration-200 ease-in-out shadow-md">
                  <Tv className="mr-2 h-4 w-4" /> Watch Ad for +1 {HeartIconPlain(true)}
                </Button>
              )}
              {(gameState === 'idle' || gameState === 'waiting_for_hearts' || gameState === 'gameover_attempt') && <p className="text-xs text-muted-foreground mt-3">Tap screen or press Space to drop blocks. Perfect drops earn more!</p> }
            </div>
          )}
        </div>

        {isAdDialogOpen && (
          <Dialog open={isAdDialogOpen} onOpenChange={(open) => { if (!open && gameState === 'ad_viewing') closeAdDialogEarly() }}>
            <DialogContent className="sm:max-w-xs bg-slate-800/95 backdrop-blur-md border-slate-700 text-slate-100 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-yellow-300 text-lg"><Tv className="h-5 w-5" /> Simulated Ad</DialogTitle>
                <DialogDescription className="text-slate-400 text-sm">Reward: +1 {HeartIconPlain(true)}.</DialogDescription>
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


    
