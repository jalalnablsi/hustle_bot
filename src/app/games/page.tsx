
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Heart, Play, Tv, RefreshCw as TryAgainIcon, Layers as GameIcon, AlertTriangle, Info, Coins, Gem, Loader2, MousePointerClick, Award, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { useUser } from '@/contexts/UserContext';

const GAME_AREA_WIDTH_BASE = 320;
const GAME_AREA_HEIGHT_MIN = 500; // This will define the aspect ratio of the playable canvas
const INITIAL_BLOCK_HEIGHT = 20;
const INITIAL_BASE_WIDTH = 120;
const MIN_BLOCK_WIDTH = 10;

const MAX_POOLED_HEARTS = 5;

const GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP = 2;
const GOLD_FOR_PERFECT_DROP = 5;
const DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS = 0.05;

const MAX_ADS_REVIVES_PER_ATTEMPT = 1;
const AD_REVIVE_DURATION_S = 5;
const DIAMONDS_TO_CONTINUE_ATTEMPT = 0.008;
const MAX_DIAMOND_CONTINUES_PER_ATTEMPT = 5;

const BLOCK_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
  'hsl(var(--accent)/0.8)', 'hsl(var(--primary)/0.8)', 'hsl(var(--secondary)/0.8)',
];

const BLOCK_SLIDE_SPEED_START = 3.2; // Slightly increased
const BLOCK_SLIDE_SPEED_INCREMENT = 0.15; // Slightly increased
const MAX_BLOCK_SLIDE_SPEED = 7.0; // Slightly increased

const PERFECT_DROP_THRESHOLD = 3;

const GAME_TYPE_IDENTIFIER = 'stake-builder';

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

const HEADER_HEIGHT_CSS_VAR = 'var(--header-height, 64px)';
const BOTTOM_NAV_HEIGHT_CSS_VAR = 'var(--bottom-nav-height, 64px)';


export default function StakeBuilderGamePage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession } = useUser();
  const [isGameApiLoading, setIsGameApiLoading] = useState(false); // For specific API calls within the game

  const [gameState, setGameState] = useState<'loading_user_data' | 'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts'>('loading_user_data');

  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfectDrops, setConsecutivePerfectDrops] = useState(0);
  const [stakeBuilderHighScore, setStakeBuilderHighScore] = useState(0);

  const [pooledHearts, setPooledHearts] = useState(0);
  const [nextHeartRegenTime, setNextHeartRegenTime] = useState<number | null>(null);
  const [timeToNextHeart, setTimeToNextHeart] = useState<string>("");

  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);
  const [stackVisualOffsetY, setStackVisualOffsetY] = useState(0);

  const [adsRevivesUsedThisAttempt, setAdsRevivesUsedThisAttempt] = useState(0);
  const [diamondContinuesUsedThisAttempt, setDiamondContinuesUsedThisAttempt] = useState(0);

  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(AD_REVIVE_DURATION_S);
  const [adProgress, setAdProgress] = useState(0);
  const [adPurpose, setAdPurpose] = useState<'revive_attempt' | 'gain_pooled_heart' | null>(null);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const { toast } = useToast();

  const getGameAreaWidth = useCallback(() => {
    if (typeof window !== 'undefined') {
        const gamePageContainer = document.getElementById('stake-builder-game-page-container');
        if (gamePageContainer) {
            return Math.min(gamePageContainer.clientWidth - 16, GAME_AREA_WIDTH_BASE + 80);
        }
        return Math.min(window.innerWidth * 0.95, GAME_AREA_WIDTH_BASE + 80);
    }
    return GAME_AREA_WIDTH_BASE + 80;
  }, []);
  const [gameAreaWidth, setGameAreaWidth] = useState(getGameAreaWidth());

  useEffect(() => {
    const handleResize = () => setGameAreaWidth(getGameAreaWidth());
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameAreaWidth]);

  const updateHeartStateFromApi = useCallback((apiData: any) => {
    let heartsCount = -1; // Use -1 to indicate data not found yet
    let nextRegenTimestamp: string | null = null;

    if (apiData && apiData.success) {
        if (apiData.hearts && typeof apiData.hearts[GAME_TYPE_IDENTIFIER] === 'number') { // Handles {"success":true,"hearts":{"stake-builder":5}, ...}
            heartsCount = apiData.hearts[GAME_TYPE_IDENTIFIER];
            nextRegenTimestamp = apiData.nextReplenishTime || null;
        } else if (typeof apiData.hearts === 'number') { // Handles {"success":true,"hearts":5, ...}
            heartsCount = apiData.hearts;
            nextRegenTimestamp = apiData.nextReplenishTime || apiData.nextRegen || null;
        } else if (apiData.remainingHearts && typeof apiData.remainingHearts[GAME_TYPE_IDENTIFIER] === 'number') {
            heartsCount = apiData.remainingHearts[GAME_TYPE_IDENTIFIER];
            nextRegenTimestamp = apiData.nextReplenishTime || null;
        } else if (typeof apiData.remainingHearts === 'number') {
             heartsCount = apiData.remainingHearts;
             nextRegenTimestamp = apiData.nextReplenishTime || null;
        }
    }

    if (heartsCount !== -1) {
        setPooledHearts(heartsCount);
        if (nextRegenTimestamp && heartsCount < MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(new Date(nextRegenTimestamp).getTime());
        } else {
            setNextHeartRegenTime(null);
        }
        // This is crucial: update gameState based on fetched hearts
        if ((gameState === 'loading_user_data' || gameState === 'waiting_for_hearts') && heartsCount > 0) {
            setGameState('idle');
        } else if (heartsCount <= 0 && gameState !== 'playing' && gameState !== 'gameover_attempt' && gameState !== 'ad_viewing') {
            setGameState('waiting_for_hearts');
        }

    } else if (apiData && !apiData.success && apiData.error) {
         toast({ title: 'Heart Sync Failed', description: apiData.error || 'Could not sync hearts with server.', variant: 'destructive' });
    }
  }, [toast, gameState]);


  const fetchUserGameData = useCallback(async (userIdForFetch: string) => {
    if (!userIdForFetch) return;
    // For initial load, set a general loading state for the page, not just API loading
    // setGameState('loading_user_data') is handled by the useEffect watching currentUser
    setIsGameApiLoading(true);
    try {
      // Fetch High Score
      const highScoreRes = await fetch(`/api/games/high-scores?userId=${userIdForFetch}&gameType=${GAME_TYPE_IDENTIFIER}`);
      if (highScoreRes.ok) {
        const highScoreData = await highScoreRes.json();
        if (highScoreData.success) {
          setStakeBuilderHighScore(highScoreData.highScore || 0);
        }
      } else {
        console.warn("Failed to fetch high score.");
      }

      // Fetch Hearts
      const heartsRes = await fetch(`/api/games/hearts?userId=${userIdForFetch}`); // Pass userId
      const heartsData = await heartsRes.json();
      updateHeartStateFromApi(heartsData); // This will update hearts and potentially gameState

    } catch (error) {
      toast({ title: 'Error Loading Game Data', description: (error as Error).message, variant: 'destructive' });
      if(gameState === 'loading_user_data') setGameState('idle'); // Fallback if initial load fails
    } finally {
      setIsGameApiLoading(false);
    }
  }, [toast, updateHeartStateFromApi, gameState]);

  useEffect(() => {
    if (currentUser?.id) {
        if (gameState === 'loading_user_data') { // Only fetch if we are in initial loading state
            fetchUserGameData(currentUser.id);
        }
    } else if (!contextLoadingUser && !currentUser) {
        setGameState('idle');
        toast({ title: "User Not Loaded", description: "Cannot load game data. Please refresh or log in.", variant: "destructive"});
    }
  }, [currentUser, contextLoadingUser, fetchUserGameData, gameState]);


  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      const updateTimer = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          if (currentUser?.id) fetchUserGameData(currentUser.id); // Re-fetch all game data
          setTimeToNextHeart("");
        } else {
          const remainingMs = nextHeartRegenTime - now;
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
          setTimeToNextHeart(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      };
      updateTimer();
      intervalId = setInterval(updateTimer, 1000);
    } else if (pooledHearts >= MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      setNextHeartRegenTime(null);
      setTimeToNextHeart("");
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime, currentUser?.id, fetchUserGameData]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const checkBackendReplenish = async () => {
      if (!currentUser?.id) return;
      try {
        const res = await fetch('/api/games/replenish-hearts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id }),
        });
        const data = await res.json();
        updateHeartStateFromApi(data);
      } catch (error) {
        console.error('Error during periodic heart replenish check:', error);
      }
    };
    const replenishInterval = setInterval(checkBackendReplenish, 5 * 60 * 1000);
    return () => clearInterval(replenishInterval);
  }, [currentUser?.id, updateHeartStateFromApi]);


  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number, speed: number) => {
    const newBlockWidth = Math.max(currentTopWidth * 0.95, MIN_BLOCK_WIDTH * 1.5);
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 - newBlockWidth/3 : gameAreaWidth - newBlockWidth*2/3,
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT - 5,
      width: newBlockWidth,
      color: BLOCK_COLORS[stackedBlocks.length % BLOCK_COLORS.length],
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: Math.min(speed, MAX_BLOCK_SLIDE_SPEED),
    });
  }, [gameAreaWidth, stackedBlocks.length]);


  const initializeNewGameAttempt = useCallback(() => {
    setCurrentAttemptGold(0);
    setCurrentAttemptDiamonds(0);
    setConsecutivePerfectDrops(0);
    setAdsRevivesUsedThisAttempt(0);
    setDiamondContinuesUsedThisAttempt(0);
    setStackVisualOffsetY(0);
    const baseBlock: StackedBlock = {
      id: 'base', x: (gameAreaWidth - INITIAL_BASE_WIDTH) / 2,
      y: GAME_AREA_HEIGHT_MIN - INITIAL_BLOCK_HEIGHT,
      width: INITIAL_BASE_WIDTH, color: 'hsl(var(--muted))',
    };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y, BLOCK_SLIDE_SPEED_START);
    setGameState('playing');
  }, [gameAreaWidth, spawnNewBlock]);

  const startGameAttempt = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: "User Not Loaded", description: "Please wait or refresh.", variant: "destructive" });
      return;
    }
    if (pooledHearts <= 0 && gameState !== 'ad_viewing') {
      setGameState('waiting_for_hearts');
      toast({ title: "No Hearts Left!", description: "Watch an ad or wait for hearts to regenerate."});
      return;
    }

    setIsGameApiLoading(true); // Indicate API call is starting
    try {
      const res = await fetch('/api/games/use-heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
      });
      const data = await res.json();
      if (!data.success) {
        toast({ title: 'Could Not Start Game', description: data.error || "Failed to use a heart.", variant: 'destructive'});
        if (currentUser.id) await fetchUserGameData(currentUser.id);
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
      } else {
        updateHeartStateFromApi(data);
        initializeNewGameAttempt(); // This will set gameState to 'playing'
      }
    } catch (error) {
      toast({ title: 'Network Error', description: "Could not start game. Check connection.", variant: 'destructive'});
      setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    } finally {
      setIsGameApiLoading(false); // API call finished
    }
  }, [currentUser?.id, pooledHearts, initializeNewGameAttempt, toast, fetchUserGameData, gameState, updateHeartStateFromApi]);

  const processAttemptOver = useCallback(async () => {
    const finalScore = stackedBlocks.length -1;
    const finalGold = currentAttemptGold;
    const finalDiamonds = currentAttemptDiamonds;

    // Show Game Over UI immediately
    setGameState('gameover_attempt');

    // Submit score in the background
    if (currentUser?.id) {
      // setIsGameApiLoading(true); // Optionally indicate background submission
      try {
        const res = await fetch('/api/games/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            gameType: GAME_TYPE_IDENTIFIER,
            score: finalScore,
            goldEarned: finalGold,
            diamondEarned: finalDiamonds,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast({
            title: data.isHighScore ? "🎉 New High Score!" : "Score Saved!",
            description: `+${finalGold} Gold, +${finalDiamonds.toFixed(4)} Diamonds. Your score: ${finalScore}`,
            duration: 3000,
          });
          if (data.totalGold !== undefined && data.totalDiamonds !== undefined) {
             updateUserSession({ gold_points: data.totalGold, diamond_points: data.totalDiamonds });
          }
          if (data.isHighScore && finalScore > stakeBuilderHighScore) {
            setStakeBuilderHighScore(finalScore);
          }
        } else {
          toast({ title: "Score Submission Failed", description: data.error || "Could not save score.", variant: "destructive" });
        }
      } catch (error) {
        toast({ title: "Network Error", description: "Could not submit score.", variant: "destructive" });
      } finally {
        // setIsGameApiLoading(false);
      }
    } else {
      toast({ title: "Attempt Over!", description: `Score: ${finalScore}. Gold: ${finalGold}. Diamonds: ${finalDiamonds.toFixed(4)}. (Not saved - user not identified)`, duration: 4000 });
    }
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, toast, stakeBuilderHighScore, updateUserSession]);

  const continueCurrentAttempt = useCallback(() => {
    if (stackedBlocks.length > 0) {
        const topBlock = stackedBlocks[stackedBlocks.length -1];
        const currentSpeed = BLOCK_SLIDE_SPEED_START + ((stackedBlocks.length -1) * BLOCK_SLIDE_SPEED_INCREMENT);
        spawnNewBlock(topBlock.width, topBlock.y - stackVisualOffsetY, Math.min(currentSpeed, MAX_BLOCK_SLIDE_SPEED));
        setGameState('playing');
    } else {
        initializeNewGameAttempt();
    }
  }, [stackedBlocks, spawnNewBlock, initializeNewGameAttempt, stackVisualOffsetY]);

  const handleDropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock) return;

    // Prevent drop if block is too far off-screen from initial spawn (especially for first block)
    if (stackedBlocks.length <= 1) { // Only apply this stringent check for the first block on base
        const blockHalfWidth = currentBlock.width / 2;
        const gameAreaCenter = gameAreaWidth / 2;
        const blockCenter = currentBlock.x + blockHalfWidth;
        // Ensure the block is somewhat reasonably over the base or game area
        if (Math.abs(blockCenter - gameAreaCenter) > gameAreaWidth * 0.6 && (currentBlock.x + currentBlock.width < MIN_BLOCK_WIDTH || currentBlock.x > gameAreaWidth - MIN_BLOCK_WIDTH)) {
             // Block is extremely off-center and tiny part on screen, likely an accidental quick drop
             // console.warn("Prevented drop of first block - too off-screen.");
             // Potentially give a small toast or visual cue, or just ignore the drop
             return;
        }
    }


    setGameState('dropping');

    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    let newBlockX = currentBlock.x;
    let newBlockWidth = currentBlock.width;
    let gainedGoldThisDrop = 0;
    let isPerfectDrop = false;

    const overlapStart = Math.max(currentBlock.x, topStackBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth > MIN_BLOCK_WIDTH / 2) {
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      if (Math.abs(currentBlock.x - topStackBlock.x) < PERFECT_DROP_THRESHOLD &&
          Math.abs(currentBlock.width - topStackBlock.width) < PERFECT_DROP_THRESHOLD + 2) {
        isPerfectDrop = true;
        newBlockX = topStackBlock.x;
        newBlockWidth = topStackBlock.width;
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP;

        const newConsecutivePerfects = consecutivePerfectDrops + 1;
        setConsecutivePerfectDrops(newConsecutivePerfects);
        toast({ description: <span className="flex items-center text-sm"><Star className="h-4 w-4 mr-1 text-yellow-300 fill-yellow-300"/> Perfect! +{GOLD_FOR_PERFECT_DROP} Gold</span>, duration: 1000 });

        if (newConsecutivePerfects >= 3) {
          setCurrentAttemptDiamonds(d => parseFloat((d + DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS).toFixed(4)));
          setConsecutivePerfectDrops(0);
          toast({ description: <span className="flex items-center text-sm"><Gem className="h-4 w-4 mr-1 text-sky-400"/> 3x Perfect! +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)}💎</span>, duration: 1500, className:"bg-primary/20 border-primary/50" });
        }
      } else {
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP;
        setConsecutivePerfectDrops(0);
        if (gainedGoldThisDrop > 0) {
            toast({ description: <span className="flex items-center text-sm"><Coins className="h-4 w-4 mr-1 text-yellow-500"/> +{GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP} Gold</span>, duration: 800 });
        }
      }
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);

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
      if (visualNewBlockTopY < GAME_AREA_HEIGHT_MIN / 2.5 && stackedBlocks.length + 1 > 5) {
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT);
      }

      const nextSpeed = BLOCK_SLIDE_SPEED_START + ((stackedBlocks.length +1) * BLOCK_SLIDE_SPEED_INCREMENT);
      spawnNewBlock(newBlockWidth, newBlockY - stackVisualOffsetY, nextSpeed);
      setGameState('playing');
    } else {
      processAttemptOver();
    }
  }, [gameState, currentBlock, stackedBlocks, consecutivePerfectDrops, spawnNewBlock, processAttemptOver, toast, gameAreaWidth, stackVisualOffsetY]);

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
    if (gameState === 'playing' && currentBlock) {
      if (!gameLoopRef.current) {
          gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    } else {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, gameLoop, currentBlock]);

  const handleWatchAdForOption = useCallback(async (purpose: 'revive_attempt' | 'gain_pooled_heart') => {
    if (!currentUser?.id) {
        toast({ title: "User Error", description: "User not identified.", variant: "destructive"});
        return;
    }
    if (purpose === 'revive_attempt' && adsRevivesUsedThisAttempt >= MAX_ADS_REVIVES_PER_ATTEMPT) {
      toast({ title: "Ad Revive Limit", description: "No more ad revives this attempt.", variant: "default" });
      return;
    }
    if (purpose === 'gain_pooled_heart' && pooledHearts >= MAX_POOLED_HEARTS) {
        toast({ title: "Hearts Full", description: "You already have the maximum number of hearts.", variant: "default"});
        return;
    }
    setAdPurpose(purpose);
    setAdTimer(AD_REVIVE_DURATION_S);
    setAdProgress(0);
    setIsAdDialogOpen(true);
    setGameState('ad_viewing');
  }, [adsRevivesUsedThisAttempt, pooledHearts, currentUser?.id, toast]);


  const processAdReward = useCallback(async () => {
    if (!currentUser?.id || !adPurpose) {
        toast({ title: "Ad Reward Error", description: "User or ad purpose not identified for reward.", variant: "destructive"});
        setGameState(adPurpose === 'revive_attempt' ? 'gameover_attempt' : (pooledHearts > 0 ? 'idle' : 'waiting_for_hearts'));
        setAdPurpose(null); return;
    }

    setIsGameApiLoading(true);
    try {
        if (adPurpose === 'revive_attempt') {
            // TODO: API Call to /api/games/confirm-ad-revive (optional, could be client-trusted for this)
            setAdsRevivesUsedThisAttempt(prev => prev + 1);
            continueCurrentAttempt();
            toast({ description: "Attempt continued after Ad!", className: "bg-green-600/90 border-green-700 text-white dark:bg-green-700 dark:text-white", duration:2000 });
        } else if (adPurpose === 'gain_pooled_heart') {
            const res = await fetch('/api/games/reward-ad-heart', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER })
            });
            const data = await res.json();
            if (data.success) {
                updateHeartStateFromApi(data);
                toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> +1 Heart gained!</span>, duration: 2000 });
            } else {
                toast({ title: "Ad Reward Failed", description: data.error || "Could not grant heart from server.", variant: "destructive" });
                setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
            }
        }
    } catch (error) {
         toast({ title: "Ad Reward Error", description: (error as Error).message, variant: "destructive" });
         setGameState(adPurpose === 'revive_attempt' ? 'gameover_attempt' : (pooledHearts > 0 ? 'idle' : 'waiting_for_hearts'));
    } finally {
        setIsGameApiLoading(false);
        setAdPurpose(null);
        setAdTimer(AD_REVIVE_DURATION_S);
        setAdProgress(0);
    }
  }, [currentUser?.id, adPurpose, pooledHearts, continueCurrentAttempt, toast, updateHeartStateFromApi]);


  useEffect(() => {
    let adViewTimerId: NodeJS.Timeout | undefined;
    if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer > 0) {
      adViewTimerId = setTimeout(() => {
        setAdTimer(prev => prev - 1);
        setAdProgress(prev => Math.min(prev + (100 / AD_REVIVE_DURATION_S), 100));
      }, 1000);
    } else if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer === 0) {
      setIsAdDialogOpen(false);
      setAdProgress(100);
      processAdReward();
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, processAdReward]);


  const closeAdDialogEarly = useCallback(() => {
    setIsAdDialogOpen(false);
    if (adPurpose === 'revive_attempt') {
        setGameState('gameover_attempt');
    } else {
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    }
    setAdPurpose(null);
    setAdTimer(AD_REVIVE_DURATION_S);
    setAdProgress(0);
    toast({ title: "Ad Closed", description: "No reward granted.", variant: "default", duration: 1500 });
  }, [pooledHearts, toast, adPurpose]);

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
        toast({ title: "Not Enough Diamonds", description: `Need ${DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} diamonds. Balance: ${currentUser.diamond_points.toFixed(3)}`, variant: "destructive"});
        return;
    }

    setIsGameApiLoading(true);
    try {
        const response = await fetch('/api/games/spend-diamonds-to-continue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                gameType: GAME_TYPE_IDENTIFIER,
                diamondsToSpend: DIAMONDS_TO_CONTINUE_ATTEMPT
            })
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "Failed to use diamonds on server.");
        }

        if (data.newDiamondBalance !== undefined) {
            updateUserSession({ diamond_points: data.newDiamondBalance });
        } else {
            updateUserSession({ diamond_points: currentUser.diamond_points - DIAMONDS_TO_CONTINUE_ATTEMPT });
        }

        setDiamondContinuesUsedThisAttempt(prev => prev + 1);
        toast({
            description: ( <span className="flex items-center text-sm"> <Gem className="h-4 w-4 mr-1 text-sky-400" /> -{DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} Diamonds. Attempt continued! </span> ),
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

  const canReviveWithAd = adsRevivesUsedThisAttempt < MAX_ADS_REVIVES_PER_ATTEMPT;
  const canContinueWithDiamonds = currentUser && currentUser.diamond_points >= DIAMONDS_TO_CONTINUE_ATTEMPT && diamondContinuesUsedThisAttempt < MAX_DIAMOND_CONTINUES_PER_ATTEMPT;
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS;


  if (gameState === 'loading_user_data' || (contextLoadingUser && !currentUser)) { // Show loading if context is loading and no user yet
    return (
        <AppShell>
            <div
              id="stake-builder-game-page-container"
              className="flex flex-col flex-grow w-full items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900"
              style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_CSS_VAR} - ${BOTTOM_NAV_HEIGHT_CSS_VAR})` }}
            >
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading Game Data...</p>
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
        onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={0}
        aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
        onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space' || e.key === 'Enter') && gameState === 'playing') handleDropBlock(); }}
      >
          {/* Top Game Stats Bar */}
          <div className="w-full px-2 sm:px-4 py-2 bg-slate-900/90 backdrop-blur-sm shadow-md border-b border-primary/30 z-20">
            <div className="flex justify-between items-center max-w-5xl mx-auto">
                <div className="flex items-center space-x-1">
                {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                    <Heart key={`life-${i}`} className={cn("h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300 stroke-slate-900 stroke-[1px]", i < pooledHearts ? "text-red-500 fill-red-500 animate-pulse" : "text-slate-600 fill-slate-700")} />
                ))}
                {pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && (
                        <p className="text-xs text-yellow-300 font-medium ml-2">Next: {timeToNextHeart}</p>
                )}
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <span className="flex items-center gap-1 p-1 px-2 bg-slate-700/60 rounded-md shadow">
                        <Coins className="text-yellow-400 h-4 w-4" />
                        <span className="text-yellow-300 font-semibold tabular-nums">{currentAttemptGold}</span>
                    </span>
                    {currentAttemptDiamonds > 0 && (
                        <span className="flex items-center gap-1 p-1 px-2 bg-slate-700/60 rounded-md shadow">
                        <Gem className="text-sky-400 h-4 w-4" />
                        <span className="text-sky-300 font-semibold tabular-nums">{currentAttemptDiamonds.toFixed(4)}</span>
                        </span>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-sm sm:text-base text-yellow-300 font-bold flex items-center justify-end gap-1.5">
                        <Award className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-400"/> HS: <span className="text-slate-100 tabular-nums">{stakeBuilderHighScore}</span>
                    </p>
                </div>
            </div>
          </div>

          {/* Main Game Area (flexible height) */}
          <div className="flex-grow w-full flex items-center justify-center overflow-hidden p-2 relative">
            <div
                ref={gameAreaRef}
                className="relative bg-black/50 border-2 border-primary/20 rounded-lg overflow-hidden"
                style={{
                    height: `${GAME_AREA_HEIGHT_MIN}px`,
                    width: `${gameAreaWidth}px`,
                    backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.15) 0%, hsl(var(--accent)/0.08) 35%, transparent 65%)',
                    cursor: gameState === 'playing' ? 'pointer' : 'default',
                    willChange: 'transform',
                }}
            >
                <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
                {stackedBlocks.map(block => (
                    <div key={block.id}
                    className={cn("absolute rounded-sm border",
                        block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50",
                        block.id === 'base' ? 'border-muted/50' : 'border-border/60' // Slightly more visible border
                    )}
                    style={{
                        left: `${block.x}px`, top: `${block.y}px`,
                        width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`,
                        backgroundColor: block.color,
                        willChange: 'left, top, width',
                    }}
                    />
                ))}
                </div>
                {currentBlock && (gameState === 'playing' || gameState === 'dropping') && (
                <div className="absolute rounded-sm border border-white/30" // Brighter border for current block
                    style={{
                        left: `${currentBlock.x}px`, top: `${currentBlock.y}px`,
                        width: `${currentBlock.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`,
                        backgroundColor: currentBlock.color,
                        willChange: 'left, top, width',
                    }}
                />
                )}

                {(gameState === 'idle' || gameState === 'gameover_attempt' || gameState === 'waiting_for_hearts') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-10 p-4 text-center space-y-3 sm:space-y-4">
                    {gameState === 'idle' && (
                    <>
                        <GameIcon size={52} className="text-primary mb-1 sm:mb-2 animate-pulse" />
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 font-headline">Stake Builder</h2>
                        <p className="text-sm sm:text-base text-slate-300 mb-2 sm:mb-3 max-w-xs">Tap to drop. Stack 'em high! {pooledHearts > 0 ? `${pooledHearts} ${pooledHearts === 1 ? "heart" : "hearts"} ready.` : "No hearts."}</p>
                        { pooledHearts > 0 ? (
                            <Button onClick={startGameAttempt} disabled={isGameApiLoading} size="lg" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-lg sm:text-xl px-8 sm:px-10 py-3 sm:py-4 rounded-lg shadow-xl transform hover:scale-105">
                                {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <Play className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6" />}
                                {isGameApiLoading ? "Starting..." : `Start Game (-1 Heart)`}
                            </Button>
                        ) : (
                            <Button disabled size="lg" className="text-lg sm:text-xl px-8 sm:px-10 py-3 sm:py-4 rounded-lg shadow-lg">
                                <Heart className="mr-2 sm:mr-3 h-5 w-5 sm:h-6 sm:w-6 text-slate-500" /> No Hearts
                            </Button>
                        )}
                        {canWatchAdForPooledHeart && (
                            <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} disabled={isGameApiLoading} variant="outline" size="md" className="w-full max-w-xs mt-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900">
                            <Tv className="mr-2 h-4 w-4" /> Watch Ad for +1 <Heart className="inline h-3 w-3 fill-current"/>
                            </Button>
                        )}
                         <p className="text-xs text-muted-foreground mt-1 sm:mt-2 max-w-xs">
                           Perfect Drop: +{GOLD_FOR_PERFECT_DROP} <Coins className="inline h-3 w-3 text-yellow-500"/> | 3x Perfect: +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)} <Gem className="inline h-3 w-3 text-sky-400"/>
                        </p>
                    </>
                    )}
                    {gameState === 'waiting_for_hearts' && (
                        <>
                            <Info size={36} className="text-sky-400 mb-1 sm:mb-2" />
                            <h2 className="text-xl sm:text-2xl font-bold text-sky-300 font-headline">Out of Hearts!</h2>
                            <p className="text-sm sm:text-base mb-2 sm:mb-3 text-slate-200">
                                {timeToNextHeart ? `Next heart in: ${timeToNextHeart}` : (pooledHearts < MAX_POOLED_HEARTS ? "Checking server for hearts..." : "Hearts are full!")}
                            </p>
                            {canWatchAdForPooledHeart && (
                                <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} disabled={isGameApiLoading} variant="outline" size="md" className="w-full max-w-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900">
                                <Tv className="mr-2 h-4 w-4" /> Watch Ad for +1 <Heart className="inline h-3 w-3 fill-current"/>
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
                        {currentAttemptDiamonds > 0 && <p className="text-xs sm:text-sm mb-1 sm:mb-2 text-sky-400 flex items-center justify-center">Diamonds: <Gem className="h-3 w-3 mx-1"/> <span className="font-bold">{currentAttemptDiamonds.toFixed(4)}</span></p>}
                        <p className="text-sm sm:text-base mb-2 sm:mb-3 text-slate-300">Hearts Left: <span className={cn(pooledHearts > 0 ? "text-green-400" : "text-red-400", "font-bold")}>{pooledHearts}</span></p>

                        <div className="space-y-2 w-full max-w-xs">
                        {canReviveWithAd && (
                            <Button onClick={() => handleWatchAdForOption('revive_attempt')} disabled={isGameApiLoading} variant="outline" size="md" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900">
                            {isGameApiLoading && adPurpose === 'revive_attempt' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tv className="mr-2 h-4 w-4" />}
                            Ad to Continue ({MAX_ADS_REVIVES_PER_ATTEMPT - adsRevivesUsedThisAttempt} left)
                            </Button>
                        )}
                        {canContinueWithDiamonds && (
                            <Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading || !currentUser || currentUser.diamond_points < DIAMONDS_TO_CONTINUE_ATTEMPT} variant="outline" size="md" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-slate-900">
                                {isGameApiLoading && gameState === 'gameover_attempt' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gem className="mr-2 h-4 w-4" />}
                                Use {DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)}<Gem className="inline h-3 w-3 ml-0.5"/> ({MAX_DIAMOND_CONTINUES_PER_ATTEMPT - diamondContinuesUsedThisAttempt} left)
                            </Button>
                        )}
                        <Button onClick={handleReturnToMainMenuOrPlayAgain} disabled={isGameApiLoading && gameState === 'gameover_attempt'} variant="secondary" size="md" className="w-full">
                            {isGameApiLoading && gameState === 'gameover_attempt' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TryAgainIcon className="mr-2 h-4 w-4" />}
                            {pooledHearts > 0 ? "Play Again" : "Check Hearts"}
                            </Button>
                        </div>
                    </>
                    )}
                </div>
                )}
            </div>
          </div>
          {gameState === 'playing' && (
              <p className="text-sm text-center text-foreground/80 py-1.5 flex items-center justify-center gap-1.5 z-20">
                <MousePointerClick className="h-4 w-4" /> Tap or Space to Drop
              </p>
          )}

          {isAdDialogOpen && (
            <Dialog open={isAdDialogOpen} onOpenChange={(open) => { if (!open && gameState === 'ad_viewing') closeAdDialogEarly()}}>
              <DialogContent className="sm:max-w-xs bg-slate-800/95 backdrop-blur-md border-slate-700 text-slate-100 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-yellow-300 text-lg"><Tv className="h-5 w-5"/> Simulated Ad</DialogTitle>
                  <DialogDescription className="text-slate-400 text-sm">
                    Wait for timer. Reward: +1 {adPurpose === 'revive_attempt' ? 'Continue' : 'Heart'}.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 text-center space-y-3">
                  <div className="w-full h-32 sm:h-40 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden border border-slate-600">
                    <Image src="https://placehold.co/280x140/1f2937/4b5563.png?text=Ad+Playing..." alt="Simulated Ad Content" width={280} height={140} data-ai-hint="advertisement video placeholder" className="object-cover"/>
                  </div>
                  <Progress value={adProgress} className="w-full h-2 bg-slate-600 border border-slate-500" />
                  <p className="text-4xl font-bold text-yellow-300 tabular-nums">{adTimer}s</p>
                </div>
                <DialogFooter>
                  <Button onClick={closeAdDialogEarly} variant="destructive" size="sm" className="w-full opacity-80 hover:opacity-100"> Close Ad (No Reward) </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
    </AppShell>
  );
}

    