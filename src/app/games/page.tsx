
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Heart, Play, Tv, RefreshCw as TryAgainIcon, Layers as GameIcon, AlertTriangle, Info, Coins, Gem, Loader2, MousePointerClick, Award, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import type { AppUser } from '@/app/types';

const GAME_AREA_WIDTH_BASE = 320; // Base width for game logic
const GAME_AREA_HEIGHT_MIN = 500; // Min height for the playable area
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
const DIAMONDS_TO_CONTINUE_ATTEMPT = 0.008; // Cost to continue
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

const GAME_TYPE_IDENTIFIER = 'stake-builder'; // Used for API calls

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

// CSS variable names for header and bottom nav heights (adjust if different)
const HEADER_HEIGHT_VAR = 'var(--header-height, 64px)';
const BOTTOM_NAV_HEIGHT_VAR = 'var(--bottom-nav-height, 64px)';


export default function StakeBuilderGamePage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(true);
  const [isGameApiLoading, setIsGameApiLoading] = useState(false);

  const [gameState, setGameState] = useState<'loading_user' | 'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts'>('loading_user');
  
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
        // Use full width of the game container, minus some padding
        const gamePageContainer = document.getElementById('stake-builder-game-page-container');
        if (gamePageContainer) {
            return Math.min(gamePageContainer.clientWidth - 16, GAME_AREA_WIDTH_BASE + 60); // 16px for padding
        }
        return Math.min(window.innerWidth * 0.95, GAME_AREA_WIDTH_BASE + 60);
    }
    return GAME_AREA_WIDTH_BASE + 60;
  }, []);
  const [gameAreaWidth, setGameAreaWidth] = useState(getGameAreaWidth());

  useEffect(() => {
    const handleResize = () => setGameAreaWidth(getGameAreaWidth());
    window.addEventListener('resize', handleResize);
    // Initial set
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameAreaWidth]);

  const fetchUserHearts = useCallback(async (userIdForFetch: string) => {
    if (!userIdForFetch) return;
    setIsGameApiLoading(true);
    try {
      const res = await fetch(`/api/games/hearts?userId=${userIdForFetch}`); // Pass userId if API needs it
      const data = await res.json();

      if (data.success) {
        if (typeof data.hearts === 'number') { // Handling flat structure: {"hearts": 5, "nextReplenishTime": "..."}
            setPooledHearts(data.hearts);
            if (data.nextReplenishTime && data.hearts < MAX_POOLED_HEARTS) {
                setNextHeartRegenTime(new Date(data.nextReplenishTime).getTime());
            } else {
                setNextHeartRegenTime(null);
            }
             if (gameState === 'loading_user' || gameState === 'waiting_for_hearts') {
                setGameState(data.hearts > 0 ? 'idle' : 'waiting_for_hearts');
            }

        } else if (data.hearts && typeof data.hearts[GAME_TYPE_IDENTIFIER]?.count === 'number') { // Fallback for nested: {"hearts": {"stake-builder": {"count": 5, "nextRegen": "..."}}}
            const gameHeartData = data.hearts[GAME_TYPE_IDENTIFIER];
            setPooledHearts(Math.min(gameHeartData.count, MAX_POOLED_HEARTS));
            if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
              setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
            } else {
              setNextHeartRegenTime(null);
            }
             if (gameState === 'loading_user' || gameState === 'waiting_for_hearts') {
                setGameState(gameHeartData.count > 0 ? 'idle' : 'waiting_for_hearts');
            }
        } else {
            console.warn("Unexpected hearts data structure:", data);
            toast({ title: 'Heart Sync Failed', description: 'Received unexpected heart data from server.', variant: 'destructive' });
            if (gameState === 'loading_user') setGameState('waiting_for_hearts'); // Default to waiting if structure is wrong
        }
      } else {
        toast({ title: 'Heart Sync Failed', description: data.error || 'Could not sync hearts with server. Please try refreshing.', variant: 'destructive' });
        if (gameState === 'loading_user') setGameState('waiting_for_hearts');
      }
    } catch (error) {
      toast({ title: 'Error Fetching Hearts', description: (error as Error).message, variant: 'destructive' });
      if (gameState === 'loading_user') setGameState('waiting_for_hearts');
    } finally {
      setIsGameApiLoading(false);
    }
  }, [toast, gameState]);

  // Fetch current user and their high score
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsFetchingUser(true);
      setGameState('loading_user');
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            await fetchUserHearts(data.user.id); // Fetch hearts after getting user ID
            
            // Fetch high score (example, adjust API as needed)
            const highScoreRes = await fetch(`/api/games/high-scores?userId=${data.user.id}&gameType=${GAME_TYPE_IDENTIFIER}`);
            if (highScoreRes.ok) {
              const highScoreData = await highScoreRes.json();
              if (highScoreData.success) {
                setStakeBuilderHighScore(highScoreData.highScore || 0);
              }
            } else {
                console.warn("Could not fetch high score for stake-builder");
            }

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
    fetchInitialData();
  }, [toast, fetchUserHearts]);


  // Client-side Heart Regeneration Timer (visual countdown)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      const updateTimer = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          if(currentUser?.id) fetchUserHearts(currentUser.id); 
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
  }, [pooledHearts, nextHeartRegenTime, fetchUserHearts, currentUser?.id]);

  // Periodic Backend Heart Replenishment Check
  useEffect(() => {
    if (!currentUser?.id) return;
    const checkBackendReplenish = async () => {
      if (!currentUser?.id) return;
      try {
        const res = await fetch('/api/games/replenish-hearts', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
        });
        const data = await res.json();
        if (data.success) {
            // API should return the new heart state consistently
            if (typeof data.hearts === 'number') { // flat structure
                setPooledHearts(data.hearts);
                if (data.nextReplenish && data.hearts < MAX_POOLED_HEARTS) {
                    setNextHeartRegenTime(new Date(data.nextReplenish).getTime());
                } else {
                    setNextHeartRegenTime(null);
                }
            } else if (data.hearts && typeof data.hearts[GAME_TYPE_IDENTIFIER]?.count === 'number') { // nested structure
                const gameHeartData = data.hearts[GAME_TYPE_IDENTIFIER];
                setPooledHearts(Math.min(gameHeartData.count, MAX_POOLED_HEARTS));
                 if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
                    setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
                 } else {
                    setNextHeartRegenTime(null);
                 }
            }
             if (gameState === 'waiting_for_hearts' && pooledHearts > 0) { // Check updated pooledHearts
                setGameState('idle');
            }
        }
      } catch (error) {
        console.error('Error during periodic heart replenish check:', error);
      }
    };
    const interval = setInterval(checkBackendReplenish, 1 * 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [currentUser?.id, gameState, pooledHearts]);


  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number, speed: number) => {
    const newBlockWidth = Math.max(currentTopWidth * 0.95, MIN_BLOCK_WIDTH * 1.5); // Ensure new block isn't too small too fast
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 - newBlockWidth/3 : gameAreaWidth - newBlockWidth*2/3, // Start slightly off-screen
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT - 5, // Position above current stack top
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
      y: GAME_AREA_HEIGHT_MIN - INITIAL_BLOCK_HEIGHT, // Position at the bottom of the min game area
      width: INITIAL_BASE_WIDTH, color: 'hsl(var(--muted))',
    };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y, BLOCK_SLIDE_SPEED_START); // Pass visual Y, which is baseBlock.y for the first block
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
        if (currentUser.id) await fetchUserHearts(currentUser.id); // Re-sync hearts
        setIsGameApiLoading(false);
        return;
      }
      // API success, update local state
      if (typeof data.remainingHearts === 'number') { // Assuming flat structure for remainingHearts
         setPooledHearts(data.remainingHearts);
         if (data.nextReplenishTime && data.remainingHearts < MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(new Date(data.nextReplenishTime).getTime());
         } else if (data.remainingHearts >= MAX_POOLED_HEARTS) {
             setNextHeartRegenTime(null);
         } else if (data.remainingHearts < MAX_POOLED_HEARTS && !nextHeartRegenTime) { // If server didn't provide and timer wasn't set
            setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS);
         }
      } else if (data.remainingHearts && typeof data.remainingHearts[GAME_TYPE_IDENTIFIER]?.count === 'number') { // Nested
         const gameHeartData = data.remainingHearts[GAME_TYPE_IDENTIFIER];
         setPooledHearts(gameHeartData.count);
         if (gameHeartData.nextRegen && gameHeartData.count < MAX_POOLED_HEARTS) {
            setNextHeartRegenTime(new Date(gameHeartData.nextRegen).getTime());
         } else {
            setNextHeartRegenTime(null);
         }
      } else { 
        // Fallback: Optimistic update if API doesn't return full state
        const newHearts = Math.max(0, pooledHearts - 1);
        setPooledHearts(newHearts);
        if (newHearts < MAX_POOLED_HEARTS && nextHeartRegenTime === null) {
          setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS); 
        }
      }
      initializeNewGameAttempt();
    } catch (error) {
      toast({ title: 'Network Error', description: "Could not communicate with the server to start the game.", variant: 'destructive'});
    } finally {
      setIsGameApiLoading(false);
    }
  }, [currentUser?.id, pooledHearts, nextHeartRegenTime, initializeNewGameAttempt, toast, fetchUserHearts, gameState]);


  const processAttemptOver = useCallback(async () => {
    const finalScore = stackedBlocks.length -1; 
    const finalGold = currentAttemptGold;
    const finalDiamonds = currentAttemptDiamonds;

    const toastDescription = (
      <div className="flex flex-col gap-1">
          <span>Stacked: {finalScore} blocks</span>
          <span className="flex items-center">Earned: <Coins className="h-4 w-4 mx-1 text-yellow-500" /> {finalGold} Gold</span>
         {finalDiamonds > 0 && <span className="flex items-center">Bonus: <Gem className="h-4 w-4 mx-1 text-sky-400" /> {finalDiamonds.toFixed(4)} Diamonds</span>}
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
            goldEarned: finalGold,
            diamondEarned: finalDiamonds, 
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast({
            title: data.isHighScore ? "🎉 New High Score!" : "Attempt Over!",
            description: toastDescription,
            variant: "default",
            duration: 5000,
          });
          if (data.totalGold !== undefined && currentUser) { // Update user's total gold if returned
             setCurrentUser(prev => prev ? {...prev, gold_points: data.totalGold} : null);
          }
          if (data.totalDiamonds !== undefined && currentUser) {
            setCurrentUser(prev => prev ? {...prev, diamond_points: data.totalDiamonds} : null);
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
        setIsGameApiLoading(false);
      }
    } else {
      toast({ title: "Attempt Over!", description: <>{toastDescription} <span>(Score not saved - user not identified)</span></>, duration: 7000 });
    }
    setGameState('gameover_attempt');
  }, [currentUser, currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length, toast, stakeBuilderHighScore]); 
  
  const continueCurrentAttempt = useCallback(() => { 
    if (stackedBlocks.length > 0) {
        const topBlock = stackedBlocks[stackedBlocks.length -1];
        const currentSpeed = BLOCK_SLIDE_SPEED_START + ((stackedBlocks.length -1) * BLOCK_SLIDE_SPEED_INCREMENT);
        // Pass the visual Y of the top block, considering the stack's offset
        spawnNewBlock(topBlock.width, topBlock.y - stackVisualOffsetY, Math.min(currentSpeed, MAX_BLOCK_SLIDE_SPEED));
        setGameState('playing');
    } else {
        initializeNewGameAttempt();
    }
  }, [stackedBlocks, spawnNewBlock, initializeNewGameAttempt, stackVisualOffsetY]);

  const handleDropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock) return;

    // Safeguard: Ensure block has moved onto the game area enough
    const blockHalfWidth = currentBlock.width / 2;
    if ((currentBlock.direction === 1 && currentBlock.x < -blockHalfWidth + 10) || // Must be at least 10px on screen
        (currentBlock.direction === -1 && currentBlock.x + currentBlock.width > gameAreaWidth + blockHalfWidth - 10 )) {
      // Potentially, this means the user clicked too early, or block spawned too far off.
      // For now, we'll just ignore this drop. If it's a persistent issue, block spawning needs review.
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
          Math.abs(currentBlock.width - topStackBlock.width) < PERFECT_DROP_THRESHOLD + 2) { // Allow slightly more width diff for perfect
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
        // Only toast for non-perfect if gold is gained, to avoid spamming
        if (gainedGoldThisDrop > 0) {
            toast({ description: <span className="flex items-center"><Coins className="h-4 w-4 mr-1 text-yellow-500"/> +{GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP} Gold</span>, duration: 800 });
        }
      }
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);

      if (newBlockWidth < MIN_BLOCK_WIDTH) { // Game over if block is too small
        processAttemptOver(); return;
      }

      const newBlockY = topStackBlock.y - INITIAL_BLOCK_HEIGHT; // Y is relative to stack origin
      const newStackedBlock: StackedBlock = {
        id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: newBlockY,
        width: newBlockWidth, color: currentBlock.color, isPerfect: isPerfectDrop,
      };
      
      setStackedBlocks(prev => [...prev, newStackedBlock]);
      
      const visualNewBlockTopY = newBlockY - stackVisualOffsetY; // Visual Y on screen
      if (visualNewBlockTopY < GAME_AREA_HEIGHT_MIN / 2.5 && stackedBlocks.length + 1 > 5) { // Check against game area min height
        setStackVisualOffsetY(prevOffset => prevOffset + INITIAL_BLOCK_HEIGHT);
      }
      
      const nextSpeed = BLOCK_SLIDE_SPEED_START + ((stackedBlocks.length +1) * BLOCK_SLIDE_SPEED_INCREMENT);
      spawnNewBlock(newBlockWidth, newBlockY - stackVisualOffsetY, nextSpeed); // Pass visual top Y for next block spawn
      setGameState('playing');
    } else { // No overlap or too little overlap
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
                // For now, client-side optimistic update for revive:
                setAdsRevivesUsedThisAttempt(prev => prev + 1);
                continueCurrentAttempt();
                toast({ description: "Attempt continued after Ad!", className: "bg-green-600 border-green-700 text-white dark:bg-green-700 dark:text-white" });
            } else if (adPurpose === 'gain_pooled_heart') {
                // Actual API call to /api/games/reward-ad-heart (or similar)
                const res = await fetch('/api/games/reward-ad-heart', { // Example endpoint
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, gameType: GAME_TYPE_IDENTIFIER }),
                });
                const data = await res.json();
                if (data.success) {
                    if(typeof data.hearts === 'number') setPooledHearts(data.hearts);
                    if(data.nextReplenishTime) setNextHeartRegenTime(new Date(data.nextReplenishTime).getTime());
                    toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> +1 Heart gained from Ad!</span> });
                     if (currentUser.id) fetchUserHearts(currentUser.id); // Re-sync fully
                } else {
                    toast({ title: "Ad Reward Failed", description: data.error || "Could not grant heart from ad.", variant: "destructive" });
                    if (currentUser.id) fetchUserHearts(currentUser.id); 
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
            if (adPurpose !== 'revive_attempt' && currentUser.id) {
                 await fetchUserHearts(currentUser.id); // Ensure state consistency
            }
        }
      };
      processAdReward();
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adPurpose, currentUser, continueCurrentAttempt, pooledHearts, toast, fetchUserHearts]);


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
        
        // Simulate successful API call for now (REMOVE THIS IN PRODUCTION)
        await new Promise(resolve => setTimeout(resolve, 500)); 
        console.warn("Simulating spending diamonds. Implement API call to /api/games/spend-diamonds-to-continue");
        // Simulate backend deduction and new balance
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


  if (gameState === 'loading_user' || isFetchingUser) {
    return (
        <AppShell>
            <div className="flex flex-col items-center justify-center flex-grow w-full bg-gradient-to-br from-slate-900 via-purple-900/50 to-slate-900" style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_VAR} - ${BOTTOM_NAV_HEIGHT_VAR})` }}>
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
        className="flex flex-col flex-grow items-center w-full bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-slate-100 overflow-hidden relative"
        style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT_VAR} - ${BOTTOM_NAV_HEIGHT_VAR})` }}
        onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={0}
        aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
        onKeyDown={(e) => { if ((e.key === ' ' || e.code === 'Space' || e.key === 'Enter') && gameState === 'playing') handleDropBlock(); }}
      >
          {/* Top Bar: Score, Hearts, High Score */}
          <div className="w-full px-2 sm:px-4 py-2 bg-slate-800/80 backdrop-blur-sm shadow-xl border-b border-primary/20 z-20">
            <div className="flex justify-between items-center max-w-3xl mx-auto">
                {/* Hearts Display */}
                <div className="flex items-center space-x-1">
                {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                    <Heart key={`life-${i}`} className={cn("h-6 w-6 sm:h-7 sm:w-7 transition-all duration-300 stroke-slate-900 stroke-[1.5px]", i < pooledHearts ? "text-red-500 fill-red-500 animate-[pulse-glow_1.5s_infinite_ease-in-out]" : "text-slate-600 fill-slate-700")} />
                ))}
                </div>
                {/* Current Score Display */}
                <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                    <span className="flex items-center gap-1 p-1 bg-slate-700/60 rounded-md shadow-sm">
                        <Coins className="text-yellow-400 h-4 w-4 sm:h-5 sm:w-5" /> 
                        <span className="text-yellow-300 font-bold tabular-nums">{currentAttemptGold}</span>
                    </span>
                    {currentAttemptDiamonds > 0 && (
                        <span className="flex items-center gap-1 p-1 bg-slate-700/60 rounded-md shadow-sm">
                        <Gem className="text-sky-400 h-4 w-4 sm:h-5 sm:w-5" /> 
                        <span className="text-sky-300 font-bold tabular-nums">{currentAttemptDiamonds.toFixed(4)}</span>
                        </span>
                    )}
                </div>
                {/* High Score & Next Heart Timer */}
                <div className="text-right">
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center justify-end gap-1">
                        <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400"/> HS: <span className="font-semibold text-slate-200">{stakeBuilderHighScore}</span>
                    </p>
                    {pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && (
                        <p className="text-xs text-yellow-300 font-medium">{timeToNextHeart}</p>
                    )}
                </div>
            </div>
          </div>


          {/* Game Area Wrapper - Takes remaining space */}
          <div className="flex-grow w-full flex items-center justify-center overflow-hidden p-2 relative">
            <div
                ref={gameAreaRef} 
                className="relative bg-black/50 border-2 border-primary/20 rounded-lg overflow-hidden shadow-inner"
                style={{ 
                    height: `${GAME_AREA_HEIGHT_MIN}px`, // Fixed height for game logic
                    width: `${gameAreaWidth}px`, // Dynamic width
                    backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.15) 0%, hsl(var(--accent)/0.08) 35%, hsl(var(--slate-900)/0.6) 70%, hsl(var(--slate-900)/0.9) 100%)',
                    cursor: gameState === 'playing' ? 'pointer' : 'default',
                    willChange: 'transform', // Hint for stack offset
                }}
            >
                <div style={{ transform: `translateY(${stackVisualOffsetY}px)`, transition: 'transform 0.3s ease-out', willChange: 'transform', height: '100%' }}>
                {stackedBlocks.map(block => (
                    <div key={block.id}
                    className={cn("absolute rounded-sm border",
                        block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50",
                        block.id === 'base' ? 'border-muted/70' : 'border-border/50'
                    )}
                    style={{ 
                        left: `${block.x}px`, 
                        top: `${block.y}px`, 
                        width: `${block.width}px`, 
                        height: `${INITIAL_BLOCK_HEIGHT}px`,
                        backgroundColor: block.color, 
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10 p-4 text-center space-y-3 sm:space-y-4">
                    {gameState === 'idle' && (
                    <>
                        <GameIcon size={56} className="text-primary mb-1 sm:mb-2 animate-[pulse-glow_2s_infinite]" />
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 font-headline">Stake Builder</h2>
                        <p className="text-sm sm:text-base text-slate-300 mb-2 sm:mb-4 max-w-xs">Tap to drop. Stack 'em high! {pooledHearts} {pooledHearts === 1 ? "heart" : "hearts"} left.</p>
                        { pooledHearts > 0 ? (
                            <Button onClick={startGameAttempt} disabled={isGameApiLoading} size="xl" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-lg sm:text-xl px-8 sm:px-10 py-5 sm:py-6 rounded-lg shadow-xl transform hover:scale-105 transition-transform duration-150">
                                {isGameApiLoading ? <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <Play className="mr-2 sm:mr-3 h-6 w-6 sm:h-7 sm:w-7" />}
                                {isGameApiLoading ? "Starting..." : `Start (-1 Heart)`}
                            </Button>
                        ) : (
                            <Button disabled size="xl" className="text-lg sm:text-xl px-8 sm:px-10 py-5 sm:py-6 rounded-lg shadow-lg">
                                <Heart className="mr-2 sm:mr-3 h-6 w-6 sm:h-7 sm:w-7 text-slate-500" /> No Hearts
                            </Button>
                        )}
                        {canWatchAdForPooledHeart && (
                            <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full max-w-xs mt-2 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                            <Tv className="mr-2 h-5 w-5" /> Watch Ad for +1 <Heart className="inline h-4 w-4 fill-current"/>
                            </Button>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 sm:mt-4">
                        Perfect Drop: +{GOLD_FOR_PERFECT_DROP} Gold | 3x Perfect: +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)} Diamonds
                        </p>
                    </>
                    )}
                    {gameState === 'waiting_for_hearts' && (
                        <>
                            <Info size={40} className="text-sky-400 mb-1 sm:mb-2" />
                            <h2 className="text-2xl sm:text-3xl font-bold text-sky-300 font-headline">Out of Hearts!</h2>
                            <p className="text-base sm:text-lg mb-2 sm:mb-3 text-slate-200">
                                {timeToNextHeart ? `Next heart in: ${timeToNextHeart}` : (pooledHearts < MAX_POOLED_HEARTS ? "Checking server..." : "Hearts are full!")}
                            </p>
                            {canWatchAdForPooledHeart && (
                                <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} disabled={isGameApiLoading} variant="outline" size="lg" className="w-full max-w-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                                <Tv className="mr-2 h-5 w-5" /> Watch Ad for +1 <Heart className="inline h-4 w-4 fill-current"/>
                                </Button>
                            )}
                            {/* <Button onClick={handleReturnToMainMenu} variant="secondary" size="lg" className="w-full max-w-xs mt-2"> Return to Menu </Button> */}
                        </>
                    )}
                    {gameState === 'gameover_attempt' && (
                    <>
                        <Award size={40} className="text-yellow-400 mb-1 sm:mb-2" />
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 font-headline">Attempt Over!</h2>
                        <p className="text-lg sm:text-xl mb-0.5 text-slate-200">Stacked: <span className="font-bold text-slate-100">{stackedBlocks.length -1}</span></p>
                        <p className="text-base sm:text-lg mb-0.5 text-yellow-400 flex items-center justify-center">Gold: <Coins className="h-4 w-4 sm:h-5 sm:w-5 mx-1"/> <span className="font-bold">{currentAttemptGold}</span></p>
                        {currentAttemptDiamonds > 0 && <p className="text-sm sm:text-md mb-1 sm:mb-2 text-sky-400 flex items-center justify-center">Diamonds: <Gem className="h-3 w-3 sm:h-4 sm:w-4 mx-1"/> <span className="font-bold">{currentAttemptDiamonds.toFixed(4)}</span></p>}
                        <p className="text-base sm:text-md mb-2 sm:mb-3 text-slate-300">Hearts Left: <span className={cn(pooledHearts > 0 ? "text-green-400" : "text-red-400", "font-bold")}>{pooledHearts}</span></p>
                        
                        <div className="space-y-2 w-full max-w-xs">
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
                            <TryAgainIcon className="mr-2 h-5 w-5" /> Play Again
                            </Button>
                        </div>
                    </>
                    )}
                </div>
                )}
            </div>
          </div>
          {gameState === 'playing' && (
              <p className="text-xs sm:text-sm text-center text-foreground/70 py-2 flex items-center justify-center gap-1.5 z-20">
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
    </AppShell>
  );
}
    

    