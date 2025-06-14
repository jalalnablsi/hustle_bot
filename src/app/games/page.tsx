
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

const MAX_ADS_REVIVES_PER_ATTEMPT = 1;
const AD_REVIVE_DURATION_S = 5;

const BLOCK_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
  'hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(var(--secondary))',
];

const BLOCK_SLIDE_SPEED_START = 2.8;
const BLOCK_SLIDE_SPEED_INCREMENT = 0.12;
const MAX_BLOCK_SLIDE_SPEED = 6.0;

const GAME_TYPE_IDENTIFIER = 'stake-builder';

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

export default function StakeBuilderGamePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(true);
  const [isGameApiLoading, setIsGameApiLoading] = useState(false); // For specific game actions like useHeart, submitScore

  const [gameState, setGameState] = useState<'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts' | 'loading_user'>('loading_user');
  
  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfectDrops, setConsecutivePerfectDrops] = useState(0);

  const [pooledHearts, setPooledHearts] = useState(MAX_POOLED_HEARTS);
  const [nextHeartRegenTime, setNextHeartRegenTime] = useState<number | null>(null);
  const [timeToNextHeart, setTimeToNextHeart] = useState<string>("");

  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);
  const [stackVisualOffsetY, setStackVisualOffsetY] = useState(0);

  const [adsRevivesUsedThisAttempt, setAdsRevivesUsedThisAttempt] = useState(0);
  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(AD_REVIVE_DURATION_S);
  const [adProgress, setAdProgress] = useState(0);
  const [adPurpose, setAdPurpose] = useState<'revive_attempt' | 'gain_pooled_heart' | null>(null);
  
  const [mockUserDiamondBalance, setMockUserDiamondBalance] = useState(0.1); // Placeholder for diamond balance for spending

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
            // Initialize mock diamond balance from user or default
            setMockUserDiamondBalance(Number(data.user.diamond_points) || 0.1); 
            // setGameState('idle'); // Heart fetching will set the correct initial state
          } else {
            throw new Error(data.error || 'Failed to fetch user profile.');
          }
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      } catch (error) {
        toast({ title: 'Error Loading Profile', description: (error as Error).message, variant: 'destructive' });
        setCurrentUser(null); // Or handle error state appropriately
        setGameState('idle'); // Fallback to idle if user fetch fails
      } finally {
        setIsFetchingUser(false);
      }
    };
    fetchCurrentUser();
  }, [toast]);

  // Fetch initial hearts from backend once user is available
  useEffect(() => {
    if (!currentUser?.id || isFetchingUser) return;

    const fetchUserHearts = async () => {
      setIsGameApiLoading(true);
      try {
        const res = await fetch(`/api/games/hearts?userId=${currentUser.id}`, { // Assuming GET and userId in query
          method: 'GET',
          credentials: 'include', // If your API needs cookies
        });
        const data = await res.json();
        if (data.success && data.hearts && data.hearts[GAME_TYPE_IDENTIFIER]) {
          const gameHeartData = data.hearts[GAME_TYPE_IDENTIFIER];
          setPooledHearts(Math.min(gameHeartData.count || 0, MAX_POOLED_HEARTS));
          if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
          } else {
            setNextHeartRegenTime(null);
          }
           setGameState( (gameHeartData.count || 0) > 0 ? 'idle' : 'waiting_for_hearts');
        } else {
          // Fallback to localStorage if API fails or no data, or set to default
          const savedHearts = localStorage.getItem(`${GAME_TYPE_IDENTIFIER}_pooledHearts`);
          const savedRegenTime = localStorage.getItem(`${GAME_TYPE_IDENTIFIER}_nextHeartRegenTime`);
          const initialHearts = savedHearts !== null ? parseInt(savedHearts, 10) : MAX_POOLED_HEARTS;
          setPooledHearts(initialHearts);
          setNextHeartRegenTime(savedRegenTime !== null ? parseInt(savedRegenTime, 10) : null);
          toast({ title: 'Heart Sync', description: data.error || 'Could not sync hearts with server, using local data.', variant: 'default' });
          setGameState(initialHearts > 0 ? 'idle' : 'waiting_for_hearts');
        }
      } catch (error) {
        toast({ title: 'Error Fetching Hearts', description: (error as Error).message, variant: 'destructive' });
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts'); // Fallback based on current local state
      } finally {
        setIsGameApiLoading(false);
      }
    };
    fetchUserHearts();
  }, [currentUser, isFetchingUser, toast]);


  // Persist hearts to localStorage (client-side backup/quick load)
  useEffect(() => {
    if (currentUser?.id) { // Only save if user is identified, to avoid mixing up data
      localStorage.setItem(`${GAME_TYPE_IDENTIFIER}_pooledHearts`, pooledHearts.toString());
      if (nextHeartRegenTime !== null) {
        localStorage.setItem(`${GAME_TYPE_IDENTIFIER}_nextHeartRegenTime`, nextHeartRegenTime.toString());
      } else {
        localStorage.removeItem(`${GAME_TYPE_IDENTIFIER}_nextHeartRegenTime`);
      }
    }
  }, [pooledHearts, nextHeartRegenTime, currentUser?.id]);

  // Client-side Heart Regeneration Timer
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      const updateTimer = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          setPooledHearts(prev => {
            const newHearts = Math.min(prev + 1, MAX_POOLED_HEARTS);
            if (newHearts >= MAX_POOLED_HEARTS) {
              setNextHeartRegenTime(null); 
            } else {
              setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS); 
            }
            return newHearts;
          });
          setTimeToNextHeart("");
          if (gameState === 'waiting_for_hearts' && pooledHearts + 1 > 0) {
            setGameState('idle');
          }
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
  }, [pooledHearts, nextHeartRegenTime, gameState]);

  // Periodic Backend Heart Replenishment Check
  useEffect(() => {
    if (!currentUser?.id) return;

    const checkBackendReplenish = async () => {
      if (!currentUser?.id) return; // Ensure currentUser is still valid
      try {
        const res = await fetch('/api/games/replenish-hearts', { // Assuming POST and takes userId
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
        });
        const data = await res.json();
        if (data.success && data.hearts && data.hearts[GAME_TYPE_IDENTIFIER]) {
          const gameHeartData = data.hearts[GAME_TYPE_IDENTIFIER];
          setPooledHearts(Math.min(gameHeartData.count, MAX_POOLED_HEARTS));
           if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
          } else if (gameHeartData.count >= MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(null);
          }
          // Potentially show a silent success or a small non-intrusive notification
        } else if (data.message && data.message.includes("Not ready")) {
          // It's not time yet, this is normal
        } else {
          console.warn('Periodic heart replenish check failed or returned unexpected data:', data.error || data.message);
        }
      } catch (error) {
        console.error('Error during periodic heart replenish check:', error);
      }
    };

    const interval = setInterval(checkBackendReplenish, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [currentUser?.id]);


  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number, speed: number) => {
    const newBlockWidth = Math.max(currentTopWidth * 0.95, MIN_BLOCK_WIDTH * 2);
    setCurrentBlock({
      x: Math.random() < 0.5 ? -newBlockWidth : gameAreaWidth,
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
    if (pooledHearts <= 0) {
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
        toast({ title: 'Could Not Start Game', description: data.error || "Failed to use a heart.", variant: 'destructive'});
        // Optionally, re-fetch hearts to ensure client is in sync
        // await fetchUserHearts(); 
        setIsGameApiLoading(false);
        return;
      }
      // If API call successful, update local state
      setPooledHearts(prevHearts => {
        const newHearts = prevHearts - 1;
        if (newHearts < MAX_POOLED_HEARTS && nextHeartRegenTime === null) {
          setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS);
        }
        return newHearts;
      });
      initializeNewGameAttempt();
    } catch (error) {
      toast({ title: 'Network Error', description: "Could not communicate with the server to start the game.", variant: 'destructive'});
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser, pooledHearts, nextHeartRegenTime, initializeNewGameAttempt, toast]);


  const processAttemptOver = useCallback(async () => {
    let diamondsEarned = 0;
    if (currentAttemptGold > 0) { // Only award diamonds if some gold was earned
        diamondsEarned = currentAttemptGold * GAME_SCORE_TO_DIAMOND_CONVERSION_RATE;
        if (diamondsEarned > 0 && diamondsEarned < MIN_DIAMONDS_FROM_GAME_SCORE) {
          diamondsEarned = MIN_DIAMONDS_FROM_GAME_SCORE;
        } else if (diamondsEarned <= 0) { // Ensure it's not negative or zero if conversion is too low
            diamondsEarned = 0;
        }
    }
    
    // Final score for submission is the number of blocks successfully stacked
    const finalScore = stackedBlocks.length -1; 

    const toastDescription = (
      <div className="flex flex-col gap-1">
          <span>Stacked: {finalScore} blocks</span>
          <span className="flex items-center">Earned: <Coins className="h-4 w-4 mx-1 text-yellow-500" /> {currentAttemptGold} Gold</span>
         {diamondsEarned > 0 && <span className="flex items-center">Bonus: <Gem className="h-4 w-4 mx-1 text-sky-400" /> {diamondsEarned.toFixed(4)} Diamonds</span>}
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
            diamondEarned: parseFloat(diamondsEarned.toFixed(4)), // Ensure correct precision
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
          // Update local diamond balance if it's being tracked from user profile
          if (data.totalDiamonds !== undefined) setMockUserDiamondBalance(data.totalDiamonds);
           // TODO: Potentially trigger a global user state update here if using a global store
        } else {
          toast({ title: "Score Submission Failed", description: data.error || "Could not save score.", variant: "destructive" });
        }
      } catch (error) {
        toast({ title: "Network Error", description: "Could not submit score.", variant: "destructive" });
      } finally {
        setIsGameApiLoading(false);
      }
    } else {
      // Fallback for no currentUser (e.g., local play without login)
      toast({ title: "Attempt Over!", description: <>{toastDescription} <span>(Score not saved)</span></>, duration: 7000 });
    }
    setGameState('gameover_attempt');
  }, [currentUser, currentAttemptGold, stackedBlocks.length, toast]);
  
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
    setGameState('dropping'); 

    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    const visualTopStackBlockX = topStackBlock.x; 

    let newBlockX = currentBlock.x;
    let newBlockWidth = currentBlock.width;
    let gainedGoldThisDrop = 0;
    let gainedDiamondsThisDrop = 0; // Renamed from currentAttemptDiamonds to avoid confusion
    let isPerfectDrop = false;

    const overlapStart = Math.max(currentBlock.x, visualTopStackBlockX);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, visualTopStackBlockX + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth > MIN_BLOCK_WIDTH / 2) {
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      const perfectDropThreshold = 3;
      if (Math.abs(currentBlock.x - visualTopStackBlockX) < perfectDropThreshold && 
          Math.abs(currentBlock.width - topStackBlock.width) < perfectDropThreshold) {
        isPerfectDrop = true;
        newBlockX = topStackBlock.x; 
        newBlockWidth = topStackBlock.width; 
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP;
        
        const newConsecutivePerfects = consecutivePerfectDrops + 1;
        setConsecutivePerfectDrops(newConsecutivePerfects);
        toast({ description: <span className="flex items-center"><Star className="h-4 w-4 mr-1 text-yellow-300 fill-yellow-300"/> Perfect Drop! +{GOLD_FOR_PERFECT_DROP} Gold</span>, duration: 1500 });

        if (newConsecutivePerfects >= 3) {
          gainedDiamondsThisDrop = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS;
          setCurrentAttemptDiamonds(d => d + gainedDiamondsThisDrop);
          setConsecutivePerfectDrops(0); 
          toast({ description: <span className="flex items-center"><Gem className="h-4 w-4 mr-1 text-sky-400"/> Triple Perfect! +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)} Diamonds</span>, duration: 2500, className: "bg-sky-500/20 border-sky-500" });
        }
      } else {
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP;
        setConsecutivePerfectDrops(0);
        toast({ description: <span className="flex items-center"><Coins className="h-4 w-4 mr-1 text-yellow-500"/> +{GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP} Gold</span>, duration: 1500 });
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
      if (visualNewBlockTopY < GAME_AREA_HEIGHT / 2.5 && stackedBlocks.length + 1 > 5) {
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
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); 
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, gameLoop, currentBlock]);

  const handleWatchAdForOption = useCallback(async (purpose: 'revive_attempt' | 'gain_pooled_heart') => {
    if (purpose === 'revive_attempt' && adsRevivesUsedThisAttempt >= MAX_ADS_REVIVES_PER_ATTEMPT) {
      toast({ title: "Ad Revive Limit Reached", description: "No more ad revives for this attempt.", variant: "default" });
      return;
    }
    if (purpose === 'gain_pooled_heart' && pooledHearts >= MAX_POOLED_HEARTS) {
        toast({ title: "Hearts Full", description: "You already have the maximum number of hearts.", variant: "default"});
        return;
    }
    // TODO: If 'gain_pooled_heart', first call backend to verify eligibility for ad heart
    // For now, client-side check is primary.

    setAdPurpose(purpose);
    setAdTimer(AD_REVIVE_DURATION_S);
    setAdProgress(0);
    setIsAdDialogOpen(true);
    setGameState('ad_viewing');
  }, [adsRevivesUsedThisAttempt, pooledHearts, toast]);

  useEffect(() => {
    let adViewTimerId: NodeJS.Timeout | undefined;
    if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer > 0) {
      adViewTimerId = setTimeout(() => {
        setAdTimer(prev => prev - 1);
        setAdProgress(prev => Math.min(prev + (100 / AD_REVIVE_DURATION_S), 100));
      }, 1000);
    } else if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer === 0) {
      // Ad finished
      setIsAdDialogOpen(false);
      setAdProgress(100);
      
      const processAdReward = async () => {
        if (!currentUser?.id) {
            toast({ title: "Error", description: "User not identified for ad reward.", variant: "destructive"});
            setGameState(gameState === 'gameover_attempt' && adPurpose === 'revive_attempt' ? 'gameover_attempt' : 'idle');
            return;
        }

        setIsGameApiLoading(true);
        try {
            if (adPurpose === 'revive_attempt') {
                // TODO: Backend - Call API to verify ad view and allow revive.
                // For now, assume success if client says so.
                setAdsRevivesUsedThisAttempt(prev => prev + 1);
                continueCurrentAttempt();
                toast({ description: "Attempt continued after Ad!", className: "bg-green-600 border-green-700 text-white dark:bg-green-600 dark:text-white" });
            } else if (adPurpose === 'gain_pooled_heart') {
                // TODO: Backend - Call API /api/games/reward-ad-heart (userId, gameType)
                // For now, client optimistic update + local storage
                const res = await fetch('/api/games/reward-ad-heart', { // Example endpoint
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
                });
                const data = await res.json();
                if (data.success) {
                    setPooledHearts(prev => {
                        const newHearts = Math.min(prev + 1, MAX_POOLED_HEARTS);
                        if (newHearts < MAX_POOLED_HEARTS && nextHeartRegenTime === null) {
                            setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS);
                        } else if (newHearts >= MAX_POOLED_HEARTS) {
                            setNextHeartRegenTime(null);
                        }
                        return newHearts;
                    });
                    toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> +1 Heart gained!</span> });
                } else {
                    toast({ title: "Ad Reward Failed", description: data.error || "Could not grant heart from ad.", variant: "destructive" });
                }
            }
             setGameState(pooledHearts + (adPurpose === 'gain_pooled_heart' ? 1: 0) > 0 ? 'idle' : 'waiting_for_hearts');
        } catch (error) {
             toast({ title: "Ad Reward Error", description: (error as Error).message, variant: "destructive" });
             setGameState(gameState === 'gameover_attempt' && adPurpose === 'revive_attempt' ? 'gameover_attempt' : 'idle');
        } finally {
            setIsGameApiLoading(false);
            setAdPurpose(null);
            setAdTimer(AD_REVIVE_DURATION_S);
            setAdProgress(0);
        }
      };
      processAdReward();
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adPurpose, currentUser, continueCurrentAttempt, pooledHearts, nextHeartRegenTime, toast]);


  const closeAdDialogEarly = useCallback(() => {
    setIsAdDialogOpen(false);
    if (adPurpose === 'revive_attempt') {
        setGameState('gameover_attempt'); 
    } else if (adPurpose === 'gain_pooled_heart') {
        setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    } else {
        setGameState('idle');
    }
    setAdPurpose(null);
    setAdTimer(AD_REVIVE_DURATION_S);
    setAdProgress(0);
    toast({ title: "Ad Closed Early", description: "No reward granted.", variant: "destructive" });
  }, [pooledHearts, toast, adPurpose]);
  
  const handleSpendDiamondsToContinue = useCallback(async () => {
    if (!currentUser?.id) {
        toast({ title: "User Error", description: "Cannot spend diamonds without user identification.", variant: "destructive"});
        return;
    }
    const cost = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS; // This was an example, let's use a defined cost
    // TODO: Fetch actual diamond cost from backend or config
    // TODO: Call backend to deduct diamonds and confirm continuation
    if (mockUserDiamondBalance >= cost) {
        // For now, client-side simulation
        const newSimulatedBalance = mockUserDiamondBalance - cost;
        setMockUserDiamondBalance(newSimulatedBalance); 
        // localStorage.setItem('mockUserDiamondBalance', newSimulatedBalance.toString()); // If you want to persist this mock balance
        
        toast({
            description: (
                <span className="flex items-center">
                    <Gem className="h-4 w-4 mr-1 text-sky-400" /> -{cost.toFixed(4)} Diamonds spent. Attempt continued! (Simulated)
                </span>
            ),
        });
        continueCurrentAttempt();
    } else {
        toast({ title: "Not Enough Diamonds", description: `You need ${cost.toFixed(4)} diamonds to continue. Your balance: ${mockUserDiamondBalance.toFixed(4)} (Simulated)`, variant: "destructive"});
    }
  }, [currentUser, mockUserDiamondBalance, continueCurrentAttempt, toast]);

  const handleReturnToMainMenu = useCallback(() => { setGameState('idle'); }, []);

  const canReviveWithAd = adsRevivesUsedThisAttempt < MAX_ADS_REVIVES_PER_ATTEMPT;
  const canContinueWithDiamonds = mockUserDiamondBalance >= DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS; // Use the same cost or a specific one for diamonds
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS;

  const getDisplayedScore = () => {
    if (gameState === 'playing' || gameState === 'dropping' || gameState === 'gameover_attempt') {
      return (
        <>
          <span className="flex items-center gap-1">
            <Coins className="text-yellow-400 h-6 w-6" /> 
            <span className="text-yellow-400 tabular-nums">{currentAttemptGold}</span>
          </span>
          {currentAttemptDiamonds > 0 && (
            <span className="flex items-center gap-1 ml-3">
              <Gem className="text-sky-400 h-5 w-5" /> 
              <span className="text-sky-400 tabular-nums text-sm">{currentAttemptDiamonds.toFixed(4)}</span>
            </span>
          )}
        </>
      );
    }
    return <span className="text-slate-400">Stake Builder</span>;
  };

  if (gameState === 'loading_user' || isFetchingUser) {
    return (
        <AppShell>
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height))]">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Loading Game...</p>
            </div>
        </AppShell>
    );
  }


  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height))] pt-2 pb-2 md:pt-4 md:pb-4 bg-gradient-to-br from-slate-900 via-purple-900/40 to-slate-900 text-slate-100 overflow-hidden">
        <div
            className="flex flex-col items-center w-full max-w-sm mx-auto p-2 sm:p-4 bg-slate-800/70 text-slate-100 rounded-xl shadow-2xl border-2 border-primary/30 relative overflow-hidden backdrop-blur-sm"
            onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={0}
            aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
            onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space') && gameState === 'playing') handleDropBlock(); }}
        >
          <div className="flex justify-between items-center w-full mb-3 px-3 py-3 bg-slate-900/50 rounded-t-lg shadow-md">
            <div className="text-xl font-bold flex items-center">
                {getDisplayedScore()}
            </div>
            <div className="flex items-center space-x-1.5">
              {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                <Heart key={`life-${i}`} className={cn("h-7 w-7 transition-all duration-300", i < pooledHearts ? "text-red-500 fill-red-500 animate-pulse-glow" : "text-slate-600")} />
              ))}
            </div>
          </div>

          {(gameState === 'idle' || gameState === 'waiting_for_hearts') && pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && (
            <div className="w-full text-center py-2 px-3 bg-slate-900/60 rounded-md mb-3 text-sm shadow">
                <p className="text-yellow-300 font-medium">Next <Heart className="inline h-4 w-4 text-red-400 fill-red-400" /> in: {timeToNextHeart}</p>
            </div>
          )}

          <div
            ref={gameAreaRef} className="relative bg-black/50 border-2 border-slate-700/80 rounded-md overflow-hidden shadow-inner"
            style={{ 
                height: `${GAME_AREA_HEIGHT}px`, 
                width: `${gameAreaWidth}px`,
                backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.2) 0%, hsl(var(--accent)/0.1) 40%, hsl(var(--background)) 100%)',
                cursor: gameState === 'playing' ? 'pointer' : 'default' 
            }}
          >
            <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform' }}>
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
                      border: `1px solid ${block.id === 'base' ? 'hsl(var(--muted))' : 'hsl(var(--border))'}`,
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

            {(gameState === 'idle' || gameState === 'gameover_attempt' || gameState === 'waiting_for_hearts') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-10 p-4 text-center space-y-4">
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
                            {timeToNextHeart ? `Next heart in: ${timeToNextHeart}` : "Calculating..."}
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
                           {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Tv className="mr-2 h-5 w-5" />}
                           Ad to Continue ({MAX_ADS_REVIVES_PER_ATTEMPT - adsRevivesUsedThisAttempt} left)
                        </Button>
                      )}
                      {canContinueWithDiamonds && (
                         <Button onClick={handleSpendDiamondsToContinue} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-slate-900 transition-colors">
                            {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />}
                            Use {DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)} <Gem className="inline h-3 w-3"/> to Continue
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
              <p className="text-sm text-center text-foreground/80 mt-4 flex items-center justify-center gap-1.5">
                <MousePointerClick className="h-4 w-4" /> Tap screen or press Space to Drop Block
              </p>
          )}

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

    
