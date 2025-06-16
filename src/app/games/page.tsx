
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
const HEART_REPLENISH_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours

const GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP = 1;
const GOLD_FOR_PERFECT_DROP = 5;
const DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS = 0.5;

const DIAMONDS_TO_CONTINUE_ATTEMPT = 1; // Updated
const MAX_DIAMOND_CONTINUES_PER_ATTEMPT = 5;

const BLOCK_COLORS = [
  'hsl(var(--chart-1)/0.9)', 'hsl(var(--chart-2)/0.9)', 'hsl(var(--chart-3)/0.9)',
  'hsl(var(--chart-4)/0.9)', 'hsl(var(--chart-5)/0.9)',
  'hsl(var(--accent)/0.8)', 'hsl(var(--primary)/0.8)', 'hsl(var(--secondary)/0.8)',
];

const BLOCK_SLIDE_SPEED_START = 1.8;
const BLOCK_SLIDE_SPEED_INCREMENT_BASE = 0.04; // Base increment per block
const BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR = 0.0008; // Additional ramp based on score
const MAX_BLOCK_SLIDE_SPEED = 7.0; // Increased max speed

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
  const [timeToNextHeart, setTimeToNextHeart] = useState<string>("");
  const [canCollectManually, setCanCollectManually] = useState<boolean>(false);


  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);
  const [stackVisualOffsetY, setStackVisualOffsetY] = useState(0);

  const [diamondContinuesUsedThisAttempt, setDiamondContinuesUsedThisAttempt] = useState(0);

  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(5); // Sim ad duration
  const [adProgress, setAdProgress] = useState(0);
  const [adPurpose, setAdPurpose] = useState<'gain_pooled_heart' | null>(null);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const { toast } = useToast();

  const getGameAreaWidth = useCallback(() => {
    if (typeof window !== 'undefined') {
        const gamePageContainer = document.getElementById('stake-builder-game-page-container');
        if (gamePageContainer) {
            return window.innerWidth < 768 ? gamePageContainer.clientWidth * 0.98 : Math.min(gamePageContainer.clientWidth * 0.9, GAME_AREA_WIDTH_BASE + 200);
        }
        return window.innerWidth < 768 ? window.innerWidth * 0.98 : Math.min(window.innerWidth * 0.9, GAME_AREA_WIDTH_BASE + 200);
    }
    return GAME_AREA_WIDTH_BASE + 150; // Default fallback
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
      if (source && source !== 'checkBackendReplenish_initial_silent') {
         toast({ title: 'Heart Sync Issue', description: `Received no data from server (${source}).`, variant: 'destructive' });
      }
      return;
    }
    
    let heartsCount = -1;
    let nextRegenTimestamp: string | null = null;
    let newTotalAdViews = currentUser?.ad_views_today_count;

    if (apiData.success) {
        if (apiData.hearts && typeof apiData.hearts === 'object' && apiData.hearts !== null && typeof apiData.hearts[GAME_TYPE_IDENTIFIER] === 'number') {
            heartsCount = apiData.hearts[GAME_TYPE_IDENTIFIER]; // Handles {"hearts": {"stake-builder": 5}}
        } else if (typeof apiData.hearts === 'number') { // Handles {"hearts": 5}
            heartsCount = apiData.hearts;
        } else if (apiData.remainingHearts && typeof apiData.remainingHearts === 'object' && apiData.remainingHearts !== null && typeof apiData.remainingHearts[GAME_TYPE_IDENTIFIER] === 'number') {
            heartsCount = apiData.remainingHearts[GAME_TYPE_IDENTIFIER]; // from use-heart
        }
        
        // If no specific heart count found from above but success is true, it might be an ack from server where hearts weren't the primary data. Keep current client hearts.
        if (heartsCount === -1 && pooledHearts !== undefined) heartsCount = pooledHearts;

        nextRegenTimestamp = apiData.nextReplenishTime || apiData.nextReplenish || null;
        if (apiData.adViewsToday !== undefined) {
            newTotalAdViews = apiData.adViewsToday;
        }
    } else if (apiData.message === 'Not ready to replenish hearts yet.' && apiData.nextReplenish) {
        // If server says not ready, trust its nextReplenish time but keep local hearts
        heartsCount = pooledHearts;
        nextRegenTimestamp = apiData.nextReplenish;
    } else {
        if (source && source !== 'checkBackendReplenish_initial_silent' && apiData.error) {
            toast({ title: 'Heart Sync Failed', description: `${apiData.error} (Source: ${source || 'Unknown'})`, variant: 'destructive' });
        }
         // If API call failed to update hearts, don't change local heart state unless it's clearly an error that implies 0 hearts
        return;
    }

    if (heartsCount !== -1) {
        setPooledHearts(Math.min(heartsCount, MAX_POOLED_HEARTS));
        if (nextRegenTimestamp && heartsCount < MAX_POOLED_HEARTS) {
            const regenTime = new Date(nextRegenTimestamp).getTime();
            setNextHeartRegenTime(regenTime > Date.now() ? regenTime : null); // Only set future regen times
        } else {
            setNextHeartRegenTime(null); // No regen if full or no time provided
        }
    }
    
    if (newTotalAdViews !== undefined && newTotalAdViews !== currentUser?.ad_views_today_count) {
        updateUserSession({ ad_views_today_count: newTotalAdViews });
    }
  }, [currentUser, pooledHearts, updateUserSession, toast]);

  // This useEffect manages the countdown timer display and manual collection readiness
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime && nextHeartRegenTime > Date.now()) {
      setCanCollectManually(false);
      const updateTimer = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          setTimeToNextHeart("Ready to Collect!");
          setCanCollectManually(true);
          // Optionally: automatically call checkBackendReplenish(false) here if desired
        } else {
          const remainingMs = nextHeartRegenTime - now;
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
          setTimeToNextHeart(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      };
      updateTimer(); // Initial call
      intervalId = setInterval(updateTimer, 1000);
    } else if (pooledHearts < MAX_POOLED_HEARTS && (!nextHeartRegenTime || nextHeartRegenTime <= Date.now())) {
      setTimeToNextHeart("Collect Heart"); // Or "Ready!"
      setCanCollectManually(true);
    } else { // Hearts are full or other conditions
      setTimeToNextHeart("");
      setCanCollectManually(false);
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime]);

  const checkBackendReplenish = useCallback(async (showLoadingToast = true) => {
      if (!currentUser?.id || isGameApiLoading) return;
      setIsGameApiLoading(true);
      if(showLoadingToast) toast({ description: "Checking for heart replenishment...", duration: 2000, icon: <RefreshCw className="h-4 w-4 animate-spin"/> });
      try {
        const res = await fetch('/api/games/replenish-hearts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id }),
        });
        const data = await res.json();
        const previousHearts = pooledHearts;
        updateHeartStateFromApi(data, 'checkBackendReplenish_manual');

        if (data.success && data.hearts) {
            const newHearts = typeof data.hearts === 'number' ? data.hearts : data.hearts[GAME_TYPE_IDENTIFIER];
            if (newHearts > previousHearts) {
                 toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> Heart(s) replenished!</span>, duration: 2500});
            } else if (showLoadingToast && newHearts === previousHearts && previousHearts < MAX_POOLED_HEARTS && data.message !== 'Not ready to replenish hearts yet.') {
                 // If called manually and no hearts were gained, but it wasn't because it's "not ready yet"
                 toast({ description: "No new hearts available to collect right now.", duration: 2500});
            }
        } else if (!data.success && data.error && showLoadingToast) {
            toast({title: "Replenish Failed", description: data.error, variant: "destructive"})
        }
      } catch (error) {
        console.error('Error during heart replenish check:', error);
        if (showLoadingToast) toast({title: "Network Error", description: "Failed to check heart replenishment.", variant: "destructive"})
      } finally {
        setIsGameApiLoading(false);
      }
    }, [currentUser?.id, updateHeartStateFromApi, isGameApiLoading, pooledHearts, toast]);

  const fetchUserGameData = useCallback(async (userIdForFetch: string) => {
    if (!userIdForFetch) return;
    setIsGameApiLoading(true); // This can be a specific loading state for game data
    try {
      const highScoreRes = await fetch(`/api/games/high-scores?userId=${userIdForFetch}&gameType=${GAME_TYPE_IDENTIFIER}`);
      if (highScoreRes.ok) {
        const highScoreData = await highScoreRes.json();
        if (highScoreData.success) setStakeBuilderHighScore(highScoreData.highScore || 0);
      } else console.warn("Failed to fetch high score.");

      // Initial replenish check - this fetches current hearts and next replenish time
      await checkBackendReplenish(false); // false to not show toast on initial silent load

    } catch (error) {
      toast({ title: 'Error Loading Game Data', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsInitialLoading(false);
      setIsGameApiLoading(false);
    }
  }, [toast, checkBackendReplenish]); // Added checkBackendReplenish dependency

  useEffect(() => {
    if (currentUser?.id && isInitialLoading) { // Fetch game data only once on initial load with user
        fetchUserGameData(currentUser.id);
    } else if (!contextLoadingUser && !currentUser && isInitialLoading) {
        setIsInitialLoading(false);
        setGameState('idle'); // Or a "please login" state if user is truly required to even see the page
    }
  }, [currentUser, contextLoadingUser, fetchUserGameData, isInitialLoading]);


  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number) => {
    const currentScore = Math.max(0, stackedBlocks.length - 1); // -1 for base block
    // Difficulty scaling: speed increases with score
    const speedRamp = currentScore * BLOCK_SLIDE_SPEED_INCREMENT_RAMP_FACTOR;
    const speedIncrement = BLOCK_SLIDE_SPEED_INCREMENT_BASE + speedRamp;
    const currentSpeed = Math.min(BLOCK_SLIDE_SPEED_START + (currentScore * speedIncrement), MAX_BLOCK_SLIDE_SPEED);

    const newBlockWidth = Math.max(currentTopWidth, MIN_BLOCK_WIDTH);
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 - newBlockWidth / 4 : gameAreaWidth - newBlockWidth * 3 / 4, // Start off-screen
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT - 5, // Position above the current stack
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
    spawnNewBlock(baseBlock.width, baseBlock.y); // Pass base block's y
    setGameState('playing');
  }, [gameAreaWidth, spawnNewBlock]);

  const startGameAttempt = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: "User Not Loaded", description: "Please wait or refresh.", variant: "destructive" });
      return;
    }
    if (pooledHearts <= 0 || gameState === 'playing' || gameState === 'ad_viewing') {
      if (pooledHearts <= 0) toast({ title: "No Hearts Left!", description: "Replenish hearts or watch an ad."});
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
        toast({ title: 'Could Not Start Game', description: data.error || "Failed to use a heart.", variant: 'destructive'});
        if (currentUser.id) await fetchUserGameData(currentUser.id); // Re-sync hearts if use-heart failed
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
      } else {
        updateHeartStateFromApi(data, 'startGameAttempt_useHeart'); // API response should tell new heart count
        initializeNewGameAttempt();
      }
    } catch (error) {
      toast({ title: 'Network Error', description: "Could not start game. Check connection.", variant: 'destructive'});
      setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, pooledHearts, initializeNewGameAttempt, toast, fetchUserGameData, gameState, updateHeartStateFromApi]);

  const processAttemptOver = useCallback(async () => {
    setGameState('gameover_attempt'); // Show game over screen immediately
    const finalScore = Math.max(0, stackedBlocks.length -1);
    const finalGold = currentAttemptGold;
    const finalDiamonds = currentAttemptDiamonds;

    if (currentUser?.id && (finalScore > 0 || finalGold > 0 || finalDiamonds > 0)) {
      // Submit score in the background
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
            // Toast for new high score is shown from the GameOver UI or here
          }
          // A small success toast for score submission can be added here if desired
        } else {
          toast({ title: "Score Submission Issue", description: data.error || "Could not save score to server.", variant: "destructive" });
        }
      })
      .catch(error => {
        toast({ title: "Network Error", description: "Score submission failed: " + (error as Error).message, variant: "destructive" });
      });
    }
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, stakeBuilderHighScore, updateUserSession, toast]);

  const continueCurrentAttempt = useCallback(() => {
    if (stackedBlocks.length > 0) {
        const topBlock = stackedBlocks[stackedBlocks.length -1];
        spawnNewBlock(topBlock.width, topBlock.y - stackVisualOffsetY); // Use adjusted Y
        setGameState('playing');
    } else { // Should not happen if continuing, but as a fallback
        initializeNewGameAttempt();
    }
  }, [stackedBlocks, spawnNewBlock, initializeNewGameAttempt, stackVisualOffsetY]);


  const handleDropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock || isGameApiLoading) return;
    
    setGameState('dropping'); // Visual state for block falling animation if any (currently instant)

    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    let newBlockX = currentBlock.x;
    let newBlockWidth = currentBlock.width;
    let gainedGoldThisDrop = 0;
    let gainedDiamondsThisDrop = 0;
    let isPerfectDrop = false;

    const overlapStart = Math.max(currentBlock.x, topStackBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth >= MIN_BLOCK_WIDTH * 0.8) { // Need at least 80% of min block width to count
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      const xDiff = Math.abs(currentBlock.x - topStackBlock.x);
      const widthDiff = Math.abs(currentBlock.width - topStackBlock.width);

      if (xDiff < PERFECT_DROP_THRESHOLD && widthDiff < PERFECT_DROP_THRESHOLD + 2) {
        isPerfectDrop = true;
        newBlockX = topStackBlock.x; // Align perfectly
        newBlockWidth = topStackBlock.width; // Maintain width
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP;
        setConsecutivePerfectDrops(prev => prev + 1);
        // toast({ description: <span className="flex items-center text-sm"><Star className="h-4 w-4 mr-1 text-yellow-300 fill-yellow-300"/> Perfect! +{GOLD_FOR_PERFECT_DROP} Gold</span>, duration: 1000 });

        if (consecutivePerfectDrops + 1 >= 3) {
          gainedDiamondsThisDrop = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS;
          setConsecutivePerfectDrops(0); // Reset after 3
          toast({ description: <span className="flex items-center text-sm"><Gem className="h-4 w-4 mr-1 text-sky-400"/> 3x Perfect! +{gainedDiamondsThisDrop.toFixed(2)}💎</span>, duration: 1500, className:"bg-primary/20 border-primary/50" });
        }
      } else {
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP;
        setConsecutivePerfectDrops(0);
      }
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);
      if (gainedDiamondsThisDrop > 0) {
        setCurrentAttemptDiamonds(d => parseFloat((d + gainedDiamondsThisDrop).toFixed(4)));
      }

      if (newBlockWidth < MIN_BLOCK_WIDTH) { // If block becomes too small
        processAttemptOver(); return;
      }

      const newBlockY = topStackBlock.y - INITIAL_BLOCK_HEIGHT;
      const newStackedBlock: StackedBlock = {
        id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: newBlockY,
        width: newBlockWidth, color: currentBlock.color, isPerfect: isPerfectDrop,
      };
      setStackedBlocks(prev => [...prev, newStackedBlock]);

      const visualNewBlockTopY = newBlockY - stackVisualOffsetY;
      if (visualNewBlockTopY < GAME_AREA_HEIGHT_MIN / 2.3 && stackedBlocks.length + 1 > 5) {
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT);
      }
      
      if (stackedBlocks.length > 0) { // Check if there's a stack to spawn on
        spawnNewBlock(newBlockWidth, newBlockY - stackVisualOffsetY);
        setGameState('playing');
      } else { // Should ideally not happen if game logic is correct
        processAttemptOver();
      }

    } else { // Complete miss
      processAttemptOver();
    }
  }, [gameState, currentBlock, stackedBlocks, consecutivePerfectDrops, spawnNewBlock, processAttemptOver, toast, gameAreaWidth, stackVisualOffsetY, isGameApiLoading]);

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
    if (gameState === 'playing' && currentBlock && gameAreaWidth > 0) {
      if (!gameLoopRef.current) gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, gameLoop, currentBlock, gameAreaWidth]);

  const handleWatchAdForHeart = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: "User Error", description: "User not identified.", variant: "destructive" });
      return;
    }
    if (pooledHearts >= MAX_POOLED_HEARTS) {
        toast({ title: "Hearts Full", description: "You already have the maximum hearts.", variant: "default" });
        return;
    }
    const adViewsTodayCount = currentUser.ad_views_today_count || 0; // General ad views for diamond earning page
    const dailyAdLimitForHearts = currentUser.daily_ad_views_limit || 50; // Using general limit for now, can be specific
    
    if (adViewsTodayCount >= dailyAdLimitForHearts) { // Check against appropriate limit
      toast({ title: "Daily Ad Limit", description: `Reached daily ad view limit.`, variant: "default" });
      return;
    }

    setAdPurpose('gain_pooled_heart');
    setAdTimer(5);
    setAdProgress(0);
    setIsAdDialogOpen(true);
    setGameState('ad_viewing'); // Prevent other game actions
  }, [currentUser, pooledHearts, toast]);

  const processAdReward = useCallback(async () => {
    if (!currentUser?.id || adPurpose !== 'gain_pooled_heart') {
      toast({ title: "Ad Reward Error", description: "User or ad purpose not identified.", variant: "destructive" });
      setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts'); // Revert to appropriate state
      setAdPurpose(null);
      return;
    }

    setIsGameApiLoading(true);
    try {
      const res = await fetch('/api/games/watch-ad-for-heart', { // API for heart reward
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();

      if (data.success) {
        updateHeartStateFromApi(data, 'processAdReward_watchAdForHeart'); // Update hearts and ad views
        toast({
          description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> +1 Heart gained!</span>,
          duration: 2000,
        });
        // If hearts > 0 now, game state can become 'idle'
        if ((data.hearts && (data.hearts[GAME_TYPE_IDENTIFIER] > 0 || data.hearts > 0)) || pooledHearts + 1 > 0) {
            setGameState('idle');
        } else {
            setGameState('waiting_for_hearts');
        }
      } else {
        toast({ title: "Ad Reward Failed", description: data.error || "Could not grant heart.", variant: "destructive" });
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
      }
    } catch (error) {
      console.error('Error during ad reward processing:', error);
      toast({ title: "Server Error", description: "Could not verify your ad watch.", variant: "destructive" });
      setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    } finally {
      setIsGameApiLoading(false);
      setAdPurpose(null);
    }
  }, [currentUser?.id, adPurpose, pooledHearts, toast, updateHeartStateFromApi]);

  useEffect(() => {
    let adViewTimerId: NodeJS.Timeout | undefined;
    if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer > 0) {
      adViewTimerId = setTimeout(() => {
        setAdTimer(prev => prev - 1);
        setAdProgress(prev => Math.min(prev + (100 / 5), 100)); // 5 is ad duration
      }, 1000);
    } else if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer === 0 && adProgress >= 100) {
      setIsAdDialogOpen(false); // Close dialog
      // processAdReward might be called too quickly, ensure states are settled
      if (!isGameApiLoading) {
           processAdReward();
      }
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adProgress, processAdReward, isGameApiLoading]);

  const closeAdDialogEarly = useCallback(() => {
    setIsAdDialogOpen(false);
    setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    setAdPurpose(null);
    setAdTimer(5); // Reset ad timer
    setAdProgress(0); // Reset ad progress
    toast({ title: "Ad Closed", description: "No reward granted.", variant: "default", duration: 1500 });
  }, [pooledHearts, toast]);

  const handleSpendDiamondsToContinue = useCallback(async () => {
    if (!currentUser?.id || typeof currentUser.diamond_points !== 'number') {
        toast({ title: "User Error", description: "Cannot spend diamonds. User data missing.", variant: "destructive"});
        return;
    }
    if (diamondContinuesUsedThisAttempt >= MAX_DIAMOND_CONTINUES_PER_ATTEMPT) {
        toast({ title: "Limit Reached", description: `Max ${MAX_DIAMOND_CONTINUES_PER_ATTEMPT} diamond continues per attempt.`, variant: "default"});
        return;
    }
    if (currentUser.diamond_points < DIAMONDS_TO_CONTINUE_ATTEMPT) {
        toast({ title: "Not Enough Diamonds", description: `Need ${DIAMONDS_TO_CONTINUE_ATTEMPT} 💎. Balance: ${currentUser.diamond_points.toFixed(2)}`, variant: "destructive"});
        return;
    }

    setIsGameApiLoading(true);
    try {
        const response = await fetch('/api/games/spend-diamonds-to-continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                diamondsToSpend: DIAMONDS_TO_CONTINUE_ATTEMPT
            })
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "Failed to use diamonds on server.");

        updateUserSession({ diamond_points: data.newDiamondBalance });
        setDiamondContinuesUsedThisAttempt(prev => prev + 1);
        toast({
            description: ( <span className="flex items-center text-sm"> <Gem className="h-4 w-4 mr-1 text-sky-400" /> -{DIAMONDS_TO_CONTINUE_ATTEMPT} Diamond. Attempt continued! </span> ),
            duration: 2000,
        });
        continueCurrentAttempt();

    } catch (error) {
        toast({ title: "Failed to Continue", description: (error as Error).message, variant: "destructive"});
    } finally {
        setIsGameApiLoading(false);
    }
  }, [currentUser, diamondContinuesUsedThisAttempt, continueCurrentAttempt, toast, updateUserSession]);

  const handleReturnToMainMenuOrPlayAgain = useCallback(() => {
    if(pooledHearts > 0) {
        startGameAttempt();
    } else {
        setGameState('waiting_for_hearts');
    }
  }, [pooledHearts, startGameAttempt]);

  // Derived states for button disabling logic
  const canContinueWithDiamonds = currentUser && typeof currentUser.diamond_points === 'number' && currentUser.diamond_points >= DIAMONDS_TO_CONTINUE_ATTEMPT && diamondContinuesUsedThisAttempt < MAX_DIAMOND_CONTINUES_PER_ATTEMPT;
  const adViewsToday = currentUser?.ad_views_today_count || 0;
  const dailyAdLimit = currentUser?.daily_ad_views_limit || 50; // Use general ad limit for now
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS && adViewsToday < dailyAdLimit;


  if (isInitialLoading || (contextLoadingUser && !currentUser && gameState === 'loading_user_data')) {
    return (
        <AppShell>
            <div
              id="stake-builder-game-page-container"
              className="flex flex-col flex-grow w-full items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950/80 to-slate-900"
              style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}
            >
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
        className="flex flex-col flex-grow w-full bg-gradient-to-br from-slate-900 via-purple-950/70 to-slate-900 text-slate-100 overflow-hidden relative"
        style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}
        onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={0}
        aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
        onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space' || e.key === 'Enter') && gameState === 'playing') handleDropBlock(); }}
      >
          {/* Top Stats Bar */}
          <div className="w-full px-2 sm:px-4 py-2 bg-slate-900/90 backdrop-blur-sm shadow-md border-b border-primary/30 z-20">
            <div className="flex flex-wrap justify-between items-center max-w-5xl mx-auto gap-y-1 gap-x-2 sm:gap-x-3">
                {/* Hearts and Regen Timer */}
                <div className="flex items-center space-x-1">
                    {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                        <Heart key={`life-${i}`} className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300 stroke-[1.5px]", i < pooledHearts ? "text-red-500 fill-red-500 animate-pulse [animation-duration:1.5s]" : "text-slate-600 fill-slate-700 stroke-slate-800")} />
                    ))}
                    {pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && (
                        <Button onClick={() => checkBackendReplenish(true)} disabled={!canCollectManually || isGameApiLoading} variant="link" size="sm"
                                className={cn("text-xs font-medium ml-1 tabular-nums h-auto p-0 leading-none",
                                 canCollectManually ? "text-green-400 hover:text-green-300" : "text-yellow-300 cursor-default hover:text-yellow-300")}>
                          {isGameApiLoading && canCollectManually ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : null}
                          {timeToNextHeart}
                        </Button>
                    )}
                </div>
                 {/* Current Attempt Score */}
                <div className="flex items-center gap-1 xs:gap-2 text-xs sm:text-sm">
                    <span className="flex items-center gap-1 p-1 px-1.5 xs:px-2 bg-slate-700/60 rounded-md shadow"> <Coins className="text-yellow-400 h-3 w-3 xs:h-4 xs:w-4" /> <span className="text-yellow-300 font-semibold tabular-nums">{currentAttemptGold}</span> </span>
                    {currentAttemptDiamonds > 0 && (
                        <span className="flex items-center gap-1 p-1 px-1.5 xs:px-2 bg-slate-700/60 rounded-md shadow"> <Gem className="text-sky-400 h-3 w-3 xs:h-4 xs:w-4" /> <span className="text-sky-300 font-semibold tabular-nums">{currentAttemptDiamonds.toFixed(2)}</span> </span>
                    )}
                </div>
                {/* High Score */}
                 <p className="text-xs sm:text-sm font-bold flex items-center justify-end gap-1 sm:gap-1.5">
                    <Award className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400 filter drop-shadow-[0_1px_3px_rgba(250,204,21,0.7)]"/>
                    <span className="text-yellow-300 hidden xs:inline">High Score:</span>
                    <span className="text-slate-100 tabular-nums">{stakeBuilderHighScore}</span>
                 </p>
            </div>
          </div>

          {/* Game Area */}
          <div className="flex-grow w-full flex items-center justify-center overflow-hidden p-2 relative">
            { gameAreaWidth > 0 && (
            <div
                ref={gameAreaRef}
                className="relative bg-black/40 border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl shadow-primary/30"
                style={{
                    height: `${GAME_AREA_HEIGHT_MIN}px`, width: `${gameAreaWidth}px`,
                    backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.08) 0%, hsl(var(--accent)/0.04) 40%, hsl(var(--background)/0.3) 100%)',
                    cursor: gameState === 'playing' ? 'pointer' : 'default', willChange: 'transform',
                }}
            >
                <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
                {stackedBlocks.map(block => (
                    <div key={block.id}
                    className={cn("absolute rounded-sm border",
                        block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50 shadow-[0_0_15px_rgba(250,204,21,0.6)]",
                        block.id === 'base' ? 'border-muted/50' : 'border-border/60'
                    )}
                    style={{
                        left: `${block.x}px`, top: `${block.y}px`,
                        width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`,
                        backgroundColor: block.color, willChange: 'left, top, width',
                        transition: 'all 0.1s linear', // Smooth placement
                    }}/>
                ))}
                </div>
                {currentBlock && (gameState === 'playing' || gameState === 'dropping') && (
                <div className="absolute rounded-sm border border-white/40 shadow-lg"
                    style={{
                        left: `${currentBlock.x}px`, top: `${currentBlock.y}px`,
                        width: `${currentBlock.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`,
                        backgroundColor: currentBlock.color, willChange: 'left, top, width',
                    }}/>
                )}

                {(gameState === 'idle' || gameState === 'gameover_attempt' || gameState === 'waiting_for_hearts') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-10 p-4 text-center space-y-3 sm:space-y-4">
                    {gameState === 'idle' && (
                    <>
                        <Gamepad2 size={52} className="text-primary mb-1 sm:mb-2 animate-pulse [animation-duration:2s]" />
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 font-headline">Stake Builder</h2>
                        <p className="text-sm sm:text-base text-slate-300 mb-2 sm:mb-3 max-w-xs">Tap to drop. Stack 'em high! {pooledHearts > 0 ? `${pooledHearts} ${pooledHearts === 1 ? "heart" : "hearts"} ready.` : "No hearts."}</p>
                            <Button onClick={startGameAttempt}
                                    disabled={isGameApiLoading || pooledHearts <= 0 || gameState === 'playing' || gameState === 'ad_viewing'}
                                    size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-lg sm:text-xl px-8 sm:px-10 py-3 sm:py-4 rounded-lg shadow-xl transform hover:scale-105">
                                {isGameApiLoading && !(gameState === 'playing' || gameState === 'ad_viewing') ? <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <Play className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />}
                                {isGameApiLoading && !(gameState === 'playing' || gameState === 'ad_viewing') ? "Processing..." : (pooledHearts > 0 ? `Start (-1 Heart)`: "No Hearts")}
                            </Button>
                        {canWatchAdForPooledHeart && pooledHearts < MAX_POOLED_HEARTS && (
                             <Button onClick={handleWatchAdForHeart} disabled={isGameApiLoading || isAdDialogOpen} variant="outline" size="md" 
                                     className="w-full max-w-xs mt-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors duration-200 ease-in-out shadow-md hover:shadow-yellow-400/40">
                                <Tv className="mr-2 h-4 w-4" /> Watch Ad for +1 <Heart className="inline h-3 w-3 fill-current ml-1"/>
                            </Button>
                        )}
                         <p className="text-xs text-muted-foreground mt-1 sm:mt-2 max-w-xs"> Perfect Drop: +{GOLD_FOR_PERFECT_DROP} <Coins className="inline h-3 w-3 text-yellow-500"/> | 3x Perfect: +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(2)} <Gem className="inline h-3 w-3 text-sky-400"/> </p>
                    </>
                    )}
                    {gameState === 'waiting_for_hearts' && (
                        <>
                            <Heart size={36} className="text-red-500/70 mb-1 sm:mb-2" />
                            <h2 className="text-xl sm:text-2xl font-bold text-red-400 font-headline">Out of Hearts!</h2>
                             <p className="text-sm sm:text-base mb-2 sm:mb-3 text-slate-200">
                                {timeToNextHeart && timeToNextHeart !== "Collect Heart" && timeToNextHeart !== "Ready to Collect!" && pooledHearts < MAX_POOLED_HEARTS ? `Next heart in: ${timeToNextHeart}` : "No hearts to collect via timer now."}
                            </p>
                             {canCollectManually && pooledHearts < MAX_POOLED_HEARTS && (
                                <Button onClick={()=> checkBackendReplenish(true)} disabled={isGameApiLoading} variant="outline" size="lg" className="border-green-500 text-green-400 hover:bg-green-500/10 mb-2">
                                    {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <RefreshCw className="mr-2 h-5 w-5"/> }
                                    Collect Heart
                                </Button>
                            )}
                            {canWatchAdForPooledHeart && pooledHearts < MAX_POOLED_HEARTS && (
                                <Button onClick={handleWatchAdForHeart} disabled={isGameApiLoading || isAdDialogOpen} variant="outline" size="md" 
                                        className="w-full max-w-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors duration-200 ease-in-out shadow-md hover:shadow-yellow-400/40">
                                <Tv className="mr-2 h-4 w-4" /> Watch Ad for +1 <Heart className="inline h-3 w-3 fill-current ml-1"/>
                                </Button>
                            )}
                        </>
                    )}
                    {gameState === 'gameover_attempt' && (
                    <>
                        <Award size={36} className="text-yellow-400 mb-1 sm:mb-2" />
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-100 font-headline">Attempt Over!</h2>
                        <p className="text-base sm:text-lg mb-0.5 text-slate-200">Stacked: <span className="font-bold text-slate-100">{stackedBlocks.length -1}</span></p>
                        <p className="text-sm sm:text-base mb-0.5 text-yellow-400 flex items-center justify-center">Gold: <Coins className="h-4 w-4 mx-1"/> <span className="font-bold">{currentAttemptGold}</span></p>
                        {currentAttemptDiamonds > 0 && <p className="text-xs sm:text-sm mb-1 sm:mb-2 text-sky-400 flex items-center justify-center">Diamonds: <Gem className="h-3 w-3 mx-1"/> <span className="font-bold">{currentAttemptDiamonds.toFixed(2)}</span></p>}
                        <p className="text-sm sm:text-base mb-2 sm:mb-3 text-slate-300">Hearts Left: <span className={cn(pooledHearts > 0 ? "text-green-400" : "text-red-400", "font-bold")}>{pooledHearts}</span></p>
                        <div className="space-y-2 w-full max-w-xs">
                        {canContinueWithDiamonds && (
                            <Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading || !currentUser || currentUser.diamond_points < DIAMONDS_TO_CONTINUE_ATTEMPT} variant="outline" size="md" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-slate-900">
                                {isGameApiLoading && diamondContinuesUsedThisAttempt > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gem className="mr-2 h-4 w-4" />}
                                Use {DIAMONDS_TO_CONTINUE_ATTEMPT}<Gem className="inline h-3 w-3 ml-0.5"/> ({MAX_DIAMOND_CONTINUES_PER_ATTEMPT - diamondContinuesUsedThisAttempt} left)
                            </Button>
                        )}
                        <Button onClick={handleReturnToMainMenuOrPlayAgain} 
                                disabled={isGameApiLoading || (pooledHearts <= 0 && !canWatchAdForPooledHeart && !canCollectManually)} 
                                variant="secondary" size="md" className="w-full">
                            {isGameApiLoading && gameState === 'gameover_attempt' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {pooledHearts > 0 ? "Play Again (-1 Heart)" : (canCollectManually ? "Collect Heart" : (canWatchAdForPooledHeart ? "Watch Ad for Heart" : "No Hearts Left"))}
                            </Button>
                        </div>
                    </>
                    )}
                </div>
                )}
            </div>
            )}
          </div>
          {gameState === 'playing' && (
              <p className="text-sm text-center text-foreground/80 py-1.5 flex items-center justify-center gap-1.5 z-20">
                <MousePointerClick className="h-4 w-4" /> Tap screen or press Space to Drop Block
              </p>
          )}

          {isAdDialogOpen && (
            <Dialog open={isAdDialogOpen} onOpenChange={(open) => { if (!open && gameState === 'ad_viewing') closeAdDialogEarly()}}>
              <DialogContent className="sm:max-w-xs bg-slate-800/95 backdrop-blur-md border-slate-700 text-slate-100 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-yellow-300 text-lg"><Tv className="h-5 w-5"/> Simulated Ad</DialogTitle>
                  <DialogDescription className="text-slate-400 text-sm">
                    Wait for timer. Reward: +1 <Heart className="inline h-3 w-3 text-red-400 fill-red-400" />.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 text-center space-y-3">
                  <div className="w-full h-32 sm:h-40 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden border border-slate-600">
                    <Image src="https://placehold.co/280x140/1f2937/4b5563.png?text=Ad+Playing..." alt="Simulated Ad Content" width={280} height={140} data-ai-hint="advertisement video" className="object-cover"/>
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
    