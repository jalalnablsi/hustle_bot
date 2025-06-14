
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
import type { AppUser } from '@/app/types';

const GAME_AREA_WIDTH_BASE = 320;
const GAME_AREA_HEIGHT = 550;
const INITIAL_BLOCK_HEIGHT = 20;
const INITIAL_BASE_WIDTH = 120;
const MIN_BLOCK_WIDTH = 10;

const MAX_POOLED_HEARTS = 5;
const HEART_REGEN_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours per heart

// Reward constants
const GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP = 2;
const GOLD_FOR_PERFECT_DROP = 5;
const DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS = 0.05;

const MAX_ADS_REVIVES_PER_ATTEMPT = 1; // For continuing game after game over
const AD_REVIVE_DURATION_S = 5;
const DIAMONDS_TO_CONTINUE_ATTEMPT = 0.008;
const MAX_DIAMOND_CONTINUES_PER_ATTEMPT = 5;

const BLOCK_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
  'hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(var(--secondary))',
];

const BLOCK_SLIDE_SPEED_START = 2.8;
const BLOCK_SLIDE_SPEED_INCREMENT = 0.12;
const MAX_BLOCK_SLIDE_SPEED = 6.0;

const PERFECT_DROP_THRESHOLD = 3; 

const GAME_TYPE_IDENTIFIER = 'stake-builder';

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

export default function StakeBuilderGamePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(true);
  const [isGameApiLoading, setIsGameApiLoading] = useState(false);

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts' | 'loading_user'>('loading_user');
  
  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfectDrops, setConsecutivePerfectDrops] = useState(0);

  const [pooledHearts, setPooledHearts] = useState(0); // Initialized by API
  const [nextHeartRegenTime, setNextHeartRegenTime] = useState<number | null>(null); // Initialized by API
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
    if (typeof window !== 'undefined') return Math.min(window.innerWidth * 0.95, GAME_AREA_WIDTH_BASE + 40);
    return GAME_AREA_WIDTH_BASE + 40;
  }, []);
  const [gameAreaWidth, setGameAreaWidth] = useState(getGameAreaWidth());

  useEffect(() => {
    const handleResize = () => setGameAreaWidth(getGameAreaWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameAreaWidth]);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      setIsFetchingUser(true);
      setGameState('loading_user');
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
          } else {
            throw new Error(data.error || 'Failed to fetch user profile.');
          }
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        toast({ title: 'Error Loading Profile', description: (error as Error).message, variant: 'destructive' });
        setCurrentUser(null);
        setGameState('idle'); 
      } finally {
        setIsFetchingUser(false);
      }
    };
    fetchCurrentUser();
  }, [toast]);

  const fetchUserHearts = useCallback(async () => {
    if (!currentUser?.id) return;
    setIsGameApiLoading(true);
    try {
      // TODO: Ensure your /api/games/hearts endpoint can get userId from session/cookie or needs it passed.
      // For now, assuming it can infer user or doesn't need explicit userId if using cookies.
      const res = await fetch(`/api/games/hearts`); 
      const data = await res.json();
      if (data.success && data.hearts && typeof data.hearts[GAME_TYPE_IDENTIFIER]?.count === 'number') {
        const gameHeartData = data.hearts[GAME_TYPE_IDENTIFIER];
        setPooledHearts(Math.min(gameHeartData.count, MAX_POOLED_HEARTS));
        
        if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
          setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
        } else {
          setNextHeartRegenTime(null);
        }
        setGameState(gameHeartData.count > 0 ? 'idle' : 'waiting_for_hearts');
      } else {
        toast({ title: 'Heart Sync Failed', description: data.error || 'Could not sync hearts with server. Please try refreshing.', variant: 'destructive' });
        // Fallback or error state
        setPooledHearts(0); 
        setNextHeartRegenTime(null);
        setGameState('waiting_for_hearts'); // Or 'idle' if you want to allow play with 0 hearts (not recommended)
      }
    } catch (error) {
      toast({ title: 'Error Fetching Hearts', description: (error as Error).message, variant: 'destructive' });
      setPooledHearts(0);
      setNextHeartRegenTime(null);
      setGameState('waiting_for_hearts');
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, toast]);

  useEffect(() => {
    if (currentUser?.id && !isFetchingUser && gameState === 'loading_user') {
        fetchUserHearts();
    }
  }, [currentUser, isFetchingUser, fetchUserHearts, gameState]);


  // Client-side Heart Regeneration Timer (visual countdown)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      const updateTimer = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          // Time to re-fetch from server to confirm regeneration
          fetchUserHearts(); 
          setTimeToNextHeart(""); // Clear timer until next server response
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
      setNextHeartRegenTime(null); // Server should manage this, but good to clear locally too
      setTimeToNextHeart("");
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime, fetchUserHearts]);

  // Periodic Backend Heart Replenishment Check
  useEffect(() => {
    if (!currentUser?.id) return;
    const checkBackendReplenish = async () => {
      if (!currentUser?.id) return;
      try {
        // This API should handle its own logic for when to replenish
        const res = await fetch('/api/games/replenish-hearts', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id }), // Ensure API can get user from session or pass ID
        });
        const data = await res.json();
        if (data.success && data.hearts && typeof data.hearts[GAME_TYPE_IDENTIFIER]?.count === 'number') {
          const gameHeartData = data.hearts[GAME_TYPE_IDENTIFIER];
          setPooledHearts(Math.min(gameHeartData.count, MAX_POOLED_HEARTS));
          if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
          } else {
            setNextHeartRegenTime(null);
          }
          if (gameState === 'waiting_for_hearts' && gameHeartData.count > 0) {
            setGameState('idle');
          }
        }
      } catch (error) {
        console.error('Error during periodic heart replenish check:', error);
      }
    };
    const interval = setInterval(checkBackendReplenish, 5 * 60 * 1000); 
    return () => clearInterval(interval);
  }, [currentUser?.id, gameState]);


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
      y: GAME_AREA_HEIGHT - INITIAL_BLOCK_HEIGHT, 
      width: INITIAL_BASE_WIDTH, color: 'hsl(var(--muted))',
    };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y - 0, BLOCK_SLIDE_SPEED_START);
    setGameState('playing');
  }, [gameAreaWidth, spawnNewBlock]);

  const startGameAttempt = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: "User Not Loaded", description: "Please wait or refresh.", variant: "destructive" });
      return;
    }
    if (pooledHearts <= 0 && gameState !== 'ad_viewing') {
      setGameState('waiting_for_hearts');
      toast({ title: "No Hearts Left!", description: "Watch an ad or wait for hearts to regenerate.", variant: "default" });
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
        toast({ title: 'Could Not Start Game', description: data.error || "Failed to use a heart. Server might be busy or you're out of hearts.", variant: 'destructive'});
        await fetchUserHearts(); // Re-sync hearts
        setIsGameApiLoading(false);
        return;
      }
      // API success, update local state based on API response if provided, otherwise decrement optimistically
      // Best if API returns new heart count and next regen time
      if (data.remainingHearts && typeof data.remainingHearts[GAME_TYPE_IDENTIFIER]?.count === 'number') {
         const gameHeartData = data.remainingHearts[GAME_TYPE_IDENTIFIER];
         setPooledHearts(gameHeartData.count);
         if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
         } else {
            setNextHeartRegenTime(null);
         }
      } else { // Optimistic update if API doesn't return full state
        setPooledHearts(prevHearts => {
            const newHearts = Math.max(0, prevHearts - 1);
            if (newHearts < MAX_POOLED_HEARTS && nextHeartRegenTime === null) {
              setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS); // Start timer if it wasn't running AND backend didn't provide one
            }
            return newHearts;
        });
      }
      initializeNewGameAttempt();
    } catch (error) {
      toast({ title: 'Network Error', description: "Could not communicate with the server to start the game.", variant: 'destructive'});
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, pooledHearts, nextHeartRegenTime, initializeNewGameAttempt, toast, fetchUserHearts, gameState]);


  const processAttemptOver = useCallback(async () => {
    // Diamonds are only from consecutive perfect drops, already tracked in currentAttemptDiamonds
    const finalScore = stackedBlocks.length -1; 

    const toastDescription = (
      <div className="flex flex-col gap-1">
          <span>Stacked: {finalScore} blocks</span>
          <span className="flex items-center">Earned: <Coins className="h-4 w-4 mx-1 text-yellow-500" /> {currentAttemptGold} Gold</span>
         {currentAttemptDiamonds > 0 && <span className="flex items-center">Bonus: <Gem className="h-4 w-4 mx-1 text-sky-400" /> {currentAttemptDiamonds.toFixed(4)} Diamonds</span>}
      </div>
    );

    if (currentUser?.id) {
      setIsGameApiLoading(true);
      try {
        const res = await fetch('/api/games/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            gameType: GAME_TYPE_IDENTIFIER,
            score: finalScore, 
            goldEarned: currentAttemptGold,
            diamondEarned: currentAttemptDiamonds, 
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast({
            title: data.isHighScore ? "🎉 New High Score!" : "Attempt Over!",
            description: toastDescription,
            variant: "default",
            duration: 7000,
          });
          if (data.totalDiamonds !== undefined && currentUser) {
            setCurrentUser(prev => prev ? {...prev, diamond_points: data.totalDiamonds} : null);
          }
        } else {
          toast({ title: "Score Submission Failed", description: data.error || "Could not save score.", variant: "destructive" });
        }
      } catch (error) {
        toast({ title: "Network Error", description: "Could not submit score.", variant: "destructive" });
      } finally {
        setIsGameApiLoading(false);
      }
    } else {
      toast({ title: "Attempt Over!", description: <>{toastDescription} <span>(Score not saved - user not identified)</span></>, duration: 7000 });
    }
    setGameState('gameover_attempt');
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, toast]); 
  
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

    const blockHalfWidth = currentBlock.width / 2;
    if ((currentBlock.direction === 1 && currentBlock.x < -blockHalfWidth + 5) || 
        (currentBlock.direction === -1 && currentBlock.x + currentBlock.width > gameAreaWidth + blockHalfWidth - 5 )) {
      return; 
    }

    setGameState('dropping'); 

    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    const visualTopStackBlockX = topStackBlock.x; 

    let newBlockX = currentBlock.x;
    let newBlockWidth = currentBlock.width;
    let gainedGoldThisDrop = 0;
    let isPerfectDrop = false;

    const overlapStart = Math.max(currentBlock.x, visualTopStackBlockX);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, visualTopStackBlockX + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth > MIN_BLOCK_WIDTH / 2) {
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      if (Math.abs(currentBlock.x - visualTopStackBlockX) < PERFECT_DROP_THRESHOLD && 
          Math.abs(currentBlock.width - topStackBlock.width) < PERFECT_DROP_THRESHOLD + 2) {
        isPerfectDrop = true;
        newBlockX = visualTopStackBlockX; 
        newBlockWidth = topStackBlock.width; 
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP;
        
        const newConsecutivePerfects = consecutivePerfectDrops + 1;
        setConsecutivePerfectDrops(newConsecutivePerfects);
        toast({ description: <span className="flex items-center"><Star className="h-4 w-4 mr-1 text-yellow-300 fill-yellow-300"/> Perfect Drop! +{GOLD_FOR_PERFECT_DROP} Gold</span>, duration: 1200 });

        if (newConsecutivePerfects >= 3) {
          setCurrentAttemptDiamonds(d => parseFloat((d + DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS).toFixed(4)));
          setConsecutivePerfectDrops(0); 
          toast({ description: <span className="flex items-center"><Gem className="h-4 w-4 mr-1 text-sky-400"/> Triple Perfect! +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)} Diamonds</span>, duration: 1500, className: "bg-primary/20 border-primary/50" });
        }
      } else {
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP;
        setConsecutivePerfectDrops(0); 
        toast({ description: <span className="flex items-center"><Coins className="h-4 w-4 mr-1 text-yellow-500"/> +{GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP} Gold</span>, duration: 1000 });
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
      
      const visualNewBlockTopY = newBlockY + stackVisualOffsetY; // Corrected: Y is from top, so add offset
      if (visualNewBlockTopY < GAME_AREA_HEIGHT / 2.5 && stackedBlocks.length + 1 > 5) {
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT);
      }
      
      const nextSpeed = BLOCK_SLIDE_SPEED_START + ((stackedBlocks.length +1) * BLOCK_SLIDE_SPEED_INCREMENT);
      spawnNewBlock(newBlockWidth, newBlockY + stackVisualOffsetY, nextSpeed); // Pass visual top Y
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
        toast({ title: "User Error", description: "Cannot process ad action without user identification.", variant: "destructive"});
        return;
    }
    if (purpose === 'revive_attempt' && adsRevivesUsedThisAttempt >= MAX_ADS_REVIVES_PER_ATTEMPT) {
      toast({ title: "Ad Revive Limit Reached", description: "No more ad revives for this attempt.", variant: "default" });
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
      
      const processAdReward = async () => {
        if (!currentUser?.id) {
            toast({ title: "Error", description: "User not identified for ad reward.", variant: "destructive"});
            setGameState(adPurpose === 'revive_attempt' ? 'gameover_attempt' : (pooledHearts > 0 ? 'idle' : 'waiting_for_hearts'));
            return;
        }

        setIsGameApiLoading(true);
        try {
            if (adPurpose === 'revive_attempt') {
                // TODO: API Call to log ad revive usage if your backend requires it (e.g., /api/ads/log-revive)
                setAdsRevivesUsedThisAttempt(prev => prev + 1);
                continueCurrentAttempt();
                toast({ description: "Attempt continued after Ad!", className: "bg-green-600 border-green-700 text-white dark:bg-green-700 dark:text-white" });
            } else if (adPurpose === 'gain_pooled_heart') {
                // TODO: Replace with actual API call to /api/games/reward-ad-heart
                // const res = await fetch('/api/games/reward-ad-heart', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
                // });
                // const data = await res.json();
                // For now, simulate success and re-fetch hearts
                console.warn("Simulating ad reward for heart. Implement API call to /api/games/reward-ad-heart");
                await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
                const data = { success: true }; // Mock success

                if (data.success) {
                    await fetchUserHearts(); // Re-fetch to get updated hearts from (mocked) backend
                    toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> +1 Heart gained from Ad!</span> });
                } else {
                    toast({ title: "Ad Reward Failed", description: "Could not grant heart from ad. Please try again.", variant: "destructive" });
                    await fetchUserHearts(); // Still re-fetch to ensure sync
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
             // Ensure game state is reasonable after ad processing, especially if not reviving
            if (adPurpose !== 'revive_attempt') {
                // Let fetchUserHearts determine the next state based on actual heart count
            }
        }
      };
      processAdReward();
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adPurpose, currentUser?.id, continueCurrentAttempt, pooledHearts, toast, fetchUserHearts]);


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
    toast({ title: "Ad Closed Early", description: "No reward granted.", variant: "destructive" });
  }, [pooledHearts, toast, adPurpose]); 
  
  const handleSpendDiamondsToContinue = useCallback(async () => {
    if (!currentUser?.id || typeof currentUser.diamond_points !== 'number') {
        toast({ title: "User Error", description: "Cannot spend diamonds without user identification or balance.", variant: "destructive"});
        return;
    }
    if (diamondContinuesUsedThisAttempt >= MAX_DIAMOND_CONTINUES_PER_ATTEMPT) {
        toast({ title: "Limit Reached", description: `You can only continue with diamonds ${MAX_DIAMOND_CONTINUES_PER_ATTEMPT} times per attempt.`, variant: "default"});
        return;
    }
    if (currentUser.diamond_points < DIAMONDS_TO_CONTINUE_ATTEMPT) {
        toast({ title: "Not Enough Diamonds", description: `You need ${DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} diamonds. Balance: ${currentUser.diamond_points.toFixed(3)}`, variant: "destructive"});
        return;
    }
    
    setIsGameApiLoading(true);
    try {
        // TODO: Implement API call to /api/games/spend-diamonds-to-continue
        // const response = await fetch('/api/games/spend-diamonds-to-continue', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER, cost: DIAMONDS_TO_CONTINUE_ATTEMPT }),
        // });
        // const data = await response.json();
        // if (!data.success) throw new Error(data.error || "Failed to use diamonds on server.");
        
        // Simulate successful API call for now
        await new Promise(resolve => setTimeout(resolve, 500)); 
        console.warn("Simulating spending diamonds. Implement API call to /api/games/spend-diamonds-to-continue");

        const newDiamondBalance = parseFloat((currentUser.diamond_points - DIAMONDS_TO_CONTINUE_ATTEMPT).toFixed(4));
        setCurrentUser(prev => prev ? {...prev, diamond_points: newDiamondBalance} : null); // Update local user state
        setDiamondContinuesUsedThisAttempt(prev => prev + 1);
        
        toast({
            description: (
                <span className="flex items-center">
                    <Gem className="h-4 w-4 mr-1 text-sky-400" /> -{DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} Diamonds spent. Attempt continued!
                </span>
            ),
        });
        continueCurrentAttempt();

    } catch (error) {
        toast({ title: "Failed to Continue", description: (error as Error).message, variant: "destructive"});
    } finally {
        setIsGameApiLoading(false);
    }
  }, [currentUser, diamondContinuesUsedThisAttempt, continueCurrentAttempt, toast]);

  const handleReturnToMainMenu = useCallback(() => { setGameState('idle'); }, []);

  const canReviveWithAd = adsRevivesUsedThisAttempt < MAX_ADS_REVIVES_PER_ATTEMPT;
  const canContinueWithDiamonds = currentUser && currentUser.diamond_points >= DIAMONDS_TO_CONTINUE_ATTEMPT && diamondContinuesUsedThisAttempt < MAX_DIAMOND_CONTINUES_PER_ATTEMPT;
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS;

  const getDisplayedScore = () => {
    if (gameState === 'playing' || gameState === 'dropping' || gameState === 'gameover_attempt' || gameState === 'ad_viewing') {
      return (
        <>
          <span className="flex items-center gap-1.5 p-1.5 bg-slate-700/60 rounded-lg shadow-md">
            <Coins className="text-yellow-400 h-6 w-6" /> 
            <span className="text-yellow-300 font-bold text-lg tabular-nums">{currentAttemptGold}</span>
          </span>
          {currentAttemptDiamonds > 0 && (
            <span className="flex items-center gap-1.5 ml-2 p-1.5 bg-slate-700/60 rounded-lg shadow-md">
              <Gem className="text-sky-400 h-5 w-5" /> 
              <span className="text-sky-300 font-bold text-base tabular-nums">{currentAttemptDiamonds.toFixed(4)}</span>
            </span>
          )}
        </>
      );
    }
    return <span className="text-slate-300 text-lg font-semibold">Stake Builder</span>;
  };

  if (gameState === 'loading_user' || isFetchingUser) {
    return (
        <AppShell>
            <div className="flex flex-col items-center justify-center flex-grow w-full bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading Game Data...</p>
            </div>
        </AppShell>
    );
  }


  return (
    <AppShell>
      <div className="flex flex-col flex-grow items-center justify-center w-full bg-gradient-to-br from-slate-900 via-purple-900/60 to-slate-900 text-slate-100 overflow-hidden relative">
        {/* Game UI Container */}
        <div
            className="flex flex-col items-center w-full h-full max-w-xl mx-auto p-2 sm:p-3 relative" // Ensure it can grow
            onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={0}
            aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
            onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space' || e.key === 'Enter') && gameState === 'playing') handleDropBlock(); }}
        >
          {/* Top Bar: Score and Hearts */}
          <div className="flex justify-between items-center w-full mb-2 px-2 py-2 bg-slate-800/80 backdrop-blur-sm rounded-lg shadow-xl border border-primary/20">
            <div className="text-xl font-bold flex items-center">
                {getDisplayedScore()}
            </div>
            <div className="flex items-center space-x-1.5">
              {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                <Heart key={`life-${i}`} className={cn("h-7 w-7 transition-all duration-300 stroke-slate-900 stroke-[1.5px]", i < pooledHearts ? "text-red-500 fill-red-500 animate-[pulse-glow_1.5s_infinite_ease-in-out]" : "text-slate-600 fill-slate-700")} />
              ))}
            </div>
          </div>

          {(gameState === 'idle' || gameState === 'waiting_for_hearts') && pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && (
            <div className="w-full text-center py-1.5 px-3 bg-slate-800/70 backdrop-blur-sm rounded-md mb-2 text-sm shadow">
                <p className="text-yellow-300 font-medium">Next <Heart className="inline h-4 w-4 text-red-400 fill-red-400" /> in: {timeToNextHeart}</p>
            </div>
          )}

          {/* Game Area */}
          <div
            ref={gameAreaRef} className="relative bg-black/70 border-2 border-primary/30 rounded-lg overflow-hidden shadow-inner flex-grow w-full" // Use flex-grow here
            style={{ 
                minHeight: `${GAME_AREA_HEIGHT}px`, // Minimum height for game content
                width: `${gameAreaWidth}px`, // Max width control
                backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.10) 0%, hsl(var(--accent)/0.05) 30%, hsl(var(--slate-900)/0.5) 70%, hsl(var(--slate-900)/0.8) 100%)',
                cursor: gameState === 'playing' ? 'pointer' : 'default',
                willChange: 'transform', 
            }}
          >
            <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
              {stackedBlocks.map(block => (
                <div key={block.id}
                  className={cn("absolute rounded-sm",
                    block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50" 
                  )}
                  style={{ 
                      left: `${block.x}px`, 
                      top: `${block.y}px`, 
                      width: `${block.width}px`, 
                      height: `${INITIAL_BLOCK_HEIGHT}px`,
                      backgroundColor: block.color, 
                      border: `1px solid ${block.id === 'base' ? 'hsl(var(--muted)/0.7)' : 'hsl(var(--border)/0.5)'}`,
                      willChange: 'left, top, width', 
                  }}
                />
              ))}
            </div>
            {currentBlock && (gameState === 'playing' || gameState === 'dropping') && (
              <div className="absolute rounded-sm border border-white/20"
                style={{ 
                    left: `${currentBlock.x}px`, 
                    top: `${currentBlock.y}px`, 
                    width: `${currentBlock.width}px`,
                    height: `${INITIAL_BLOCK_HEIGHT}px`, 
                    backgroundColor: currentBlock.color,
                    willChange: 'left, top, width', 
                }}
              />
            )}

            {/* Game State Overlays */}
            {(gameState === 'idle' || gameState === 'gameover_attempt' || gameState === 'waiting_for_hearts') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-10 p-4 text-center space-y-4">
                {gameState === 'idle' && (
                  <>
                    <GameIcon size={64} className="text-primary mb-2 animate-[pulse-glow_2s_infinite]" />
                    <h2 className="text-4xl font-bold mb-1 text-slate-100 font-headline">Stake Builder</h2>
                    <p className="text-slate-300 mb-4 max-w-xs">Tap to drop. Stack 'em high! {pooledHearts} {pooledHearts === 1 ? "heart" : "hearts"} left.</p>
                    { pooledHearts > 0 ? (
                        <Button onClick={startGameAttempt} disabled={isGameApiLoading} size="xl" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-xl px-10 py-6 rounded-lg shadow-xl transform hover:scale-105 transition-transform duration-150">
                            {isGameApiLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Play className="mr-3 h-7 w-7" />}
                            {isGameApiLoading ? "Starting..." : `Start (-1 Heart)`}
                        </Button>
                    ) : (
                        <Button disabled size="xl" className="text-xl px-10 py-6 rounded-lg shadow-lg">
                            <Heart className="mr-3 h-7 w-7 text-slate-500" /> No Hearts
                        </Button>
                    )}
                    {canWatchAdForPooledHeart && (
                        <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full max-w-xs mt-3 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                          <Tv className="mr-2 h-5 w-5" /> Watch Ad for +1 <Heart className="inline h-4 w-4 fill-current"/>
                        </Button>
                    )}
                     <p className="text-xs text-muted-foreground mt-4">
                      Perfect Drop: +{GOLD_FOR_PERFECT_DROP} Gold | 3x Perfect: +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)} Diamonds
                    </p>
                  </>
                )}
                {gameState === 'waiting_for_hearts' && (
                    <>
                        <Info size={48} className="text-sky-400 mb-2" />
                        <h2 className="text-3xl font-bold mb-1 text-sky-300 font-headline">Out of Hearts!</h2>
                        <p className="text-lg mb-3 text-slate-200">
                            {timeToNextHeart ? `Next heart in: ${timeToNextHeart}` : (pooledHearts < MAX_POOLED_HEARTS ? "Checking server..." : "Hearts are full!")}
                        </p>
                        {canWatchAdForPooledHeart && (
                            <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full max-w-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                              <Tv className="mr-2 h-5 w-5" /> Watch Ad for +1 <Heart className="inline h-4 w-4 fill-current"/>
                            </Button>
                        )}
                        <Button onClick={handleReturnToMainMenu} variant="secondary" size="lg" className="w-full max-w-xs mt-2"> Return to Menu </Button>
                    </>
                )}
                {gameState === 'gameover_attempt' && (
                  <>
                    <Award size={48} className="text-yellow-400 mb-2" />
                    <h2 className="text-3xl font-bold mb-1 text-slate-100 font-headline">Attempt Over!</h2>
                    <p className="text-xl mb-0.5 text-slate-200">Stacked: <span className="font-bold text-slate-100">{stackedBlocks.length -1}</span></p>
                    <p className="text-lg mb-0.5 text-yellow-400 flex items-center justify-center">Gold: <Coins className="h-5 w-5 mx-1"/> <span className="font-bold">{currentAttemptGold}</span></p>
                    {currentAttemptDiamonds > 0 && <p className="text-md mb-2 text-sky-400 flex items-center justify-center">Diamonds: <Gem className="h-4 w-4 mx-1"/> <span className="font-bold">{currentAttemptDiamonds.toFixed(4)}</span></p>}
                    <p className="text-md mb-3 text-slate-300">Hearts Left: <span className={cn(pooledHearts > 0 ? "text-green-400" : "text-red-400", "font-bold")}>{pooledHearts}</span></p>
                    
                    <div className="space-y-2.5 w-full max-w-xs">
                      {canReviveWithAd && (
                        <Button onClick={() => handleWatchAdForOption('revive_attempt')} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                           {isGameApiLoading && adPurpose === 'revive_attempt' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Tv className="mr-2 h-5 w-5" />}
                           Ad to Continue ({MAX_ADS_REVIVES_PER_ATTEMPT - adsRevivesUsedThisAttempt} left)
                        </Button>
                      )}
                      {canContinueWithDiamonds && (
                         <Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-slate-900 transition-colors">
                            {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />}
                            Use {DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} <Gem className="inline h-3 w-3"/> to Continue ({MAX_DIAMOND_CONTINUES_PER_ATTEMPT - diamondContinuesUsedThisAttempt} left)
                         </Button>
                      )}
                      <Button onClick={handleReturnToMainMenu} variant="secondary" size="lg" className="w-full">
                        <TryAgainIcon className="mr-2 h-5 w-5" /> Main Menu / Play Again
                        </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {gameState === 'playing' && (
              <p className="text-sm text-center text-foreground/80 mt-2 flex items-center justify-center gap-1.5">
                <MousePointerClick className="h-4 w-4" /> Tap screen or press Space to Drop Block
              </p>
          )}

          {/* Ad Dialog */}
          {isAdDialogOpen && (
            <Dialog open={isAdDialogOpen} onOpenChange={(open) => { if (!open && gameState === 'ad_viewing') closeAdDialogEarly()}}>
              <DialogContent className="sm:max-w-md bg-slate-800/95 backdrop-blur-md border-slate-700 text-slate-100 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-yellow-300"><Tv className="h-6 w-6"/> Simulated Ad</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Please wait for the timer to finish. Reward: +1 {adPurpose === 'revive_attempt' ? 'Continue' : 'Heart'}.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6 text-center space-y-4">
                  <div className="w-full h-40 bg-slate-700 rounded-lg flex items-center justify-center overflow-hidden border border-slate-600">
                    <Image src="https://placehold.co/300x150/2d3748/a0aec0.png?text=Ad+Playing..." alt="Simulated Ad Content" width={300} height={150} data-ai-hint="advertisement video placeholder" className="object-cover"/>
                  </div>
                  <Progress value={adProgress} className="w-full h-2.5 bg-slate-600 border border-slate-500" />
                  <p className="text-5xl font-bold text-yellow-300 tabular-nums">{adTimer}s</p>
                </div>
                <DialogFooter>
                  <Button onClick={closeAdDialogEarly} variant="destructive" className="w-full opacity-80 hover:opacity-100"> Close Ad (No Reward) </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </AppShell>
  );
}

    