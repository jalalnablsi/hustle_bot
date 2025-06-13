
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Heart, Play, Tv, RefreshCw as TryAgainIcon, Layers as GameIcon, AlertTriangle, Info, Coins, Gem, Loader2, Award, Star, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from "next/image";
import { Progress } from "@/components/ui/progress"; // Added Progress for ad timer

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

// LocalStorage Keys
const LOCALSTORAGE_POOLED_HEARTS_KEY = 'stakeBuilder_pooledHearts_vFinal';
const LOCALSTORAGE_NEXT_HEART_REGEN_KEY = 'stakeBuilder_nextHeartRegenTime_vFinal';
const LOCALSTORAGE_MOCK_DIAMOND_BALANCE_KEY = 'stakeBuilder_mockDiamondBalance_vFinal'; // For simulating diamond spending

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

export default function StakeBuilderGamePage() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts'>('idle');
  
  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfectDrops, setConsecutivePerfectDrops] = useState(0);

  const [pooledHearts, setPooledHearts] = useState(MAX_POOLED_HEARTS);
  const [nextHeartRegenTime, setNextHeartRegenTime] = useState<number | null>(null);
  const [timeToNextHeart, setTimeToNextHeart] = useState<string>("");

  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);
  const [lastDropPerfect, setLastDropPerfect] = useState(false); // To trigger perfect animation once

  const [adsRevivesUsedThisAttempt, setAdsRevivesUsedThisAttempt] = useState(0);
  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(AD_REVIVE_DURATION_S);
  const [adProgress, setAdProgress] = useState(0);
  const [adPurpose, setAdPurpose] = useState<'revive_attempt' | 'gain_pooled_heart' | null>(null);

  const [mockUserDiamondBalance, setMockUserDiamondBalance] = useState(0.1); 

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const { toast } = useToast();

  const getGameAreaWidth = useCallback(() => {
    if (typeof window !== 'undefined') return Math.min(window.innerWidth * 0.95, GAME_AREA_WIDTH_BASE + 40); // Allow slight expand on wider mobile
    return GAME_AREA_WIDTH_BASE + 40;
  }, []);
  const [gameAreaWidth, setGameAreaWidth] = useState(getGameAreaWidth());

  useEffect(() => {
    const handleResize = () => setGameAreaWidth(getGameAreaWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameAreaWidth]);

  // Load initial state from localStorage
  useEffect(() => {
    const savedHearts = localStorage.getItem(LOCALSTORAGE_POOLED_HEARTS_KEY);
    setPooledHearts(savedHearts !== null ? Math.min(parseInt(savedHearts, 10), MAX_POOLED_HEARTS) : MAX_POOLED_HEARTS);

    const savedRegenTime = localStorage.getItem(LOCALSTORAGE_NEXT_HEART_REGEN_KEY);
    setNextHeartRegenTime(savedRegenTime !== null ? parseInt(savedRegenTime, 10) : null);
    
    const mockBalance = parseFloat(localStorage.getItem(LOCALSTORAGE_MOCK_DIAMOND_BALANCE_KEY) || '0.1');
    setMockUserDiamondBalance(mockBalance);
  }, []);

  // Save hearts and regen time to localStorage
  useEffect(() => { localStorage.setItem(LOCALSTORAGE_POOLED_HEARTS_KEY, pooledHearts.toString()); }, [pooledHearts]);
  useEffect(() => {
    if (nextHeartRegenTime !== null) localStorage.setItem(LOCALSTORAGE_NEXT_HEART_REGEN_KEY, nextHeartRegenTime.toString());
    else localStorage.removeItem(LOCALSTORAGE_NEXT_HEART_REGEN_KEY);
  }, [nextHeartRegenTime]);

  // Heart regeneration timer logic
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (pooledHearts < MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      const updateTimer = () => {
        const now = Date.now();
        if (now >= nextHeartRegenTime) {
          setPooledHearts(prev => {
            const newHearts = Math.min(prev + 1, MAX_POOLED_HEARTS);
            if (newHearts === MAX_POOLED_HEARTS) {
              setNextHeartRegenTime(null);
            } else {
              setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS);
            }
            return newHearts;
          });
          setTimeToNextHeart("");
          if (gameState === 'waiting_for_hearts' && pooledHearts + 1 > 0) setGameState('idle');
          // TODO: Backend - Optionally notify backend about heart regeneration if needed for server sync
        } else {
          const remainingMs = nextHeartRegenTime - now;
          const hours = Math.floor(remainingMs / (1000 * 60 * 60));
          const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
          setTimeToNextHeart(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      };
      updateTimer(); // Initial call
      intervalId = setInterval(updateTimer, 1000); // Update every second
    } else if (pooledHearts === MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      setNextHeartRegenTime(null); // Clear regen time if hearts are full
      setTimeToNextHeart("");
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime, gameState]);


  const spawnNewBlock = useCallback((currentTopWidth: number, currentTopY: number, speed: number) => {
    const newBlockWidth = Math.max(currentTopWidth * 0.95, MIN_BLOCK_WIDTH * 2); // Slight width reduction for challenge
    setCurrentBlock({
      x: Math.random() < 0.5 ? -newBlockWidth : gameAreaWidth, // Start off-screen
      y: currentTopY - INITIAL_BLOCK_HEIGHT - 5, // Spawn above last block
      width: newBlockWidth,
      color: BLOCK_COLORS[stackedBlocks.length % BLOCK_COLORS.length],
      direction: Math.random() < 0.5 ? 1 : -1, // Random initial direction
      speed: Math.min(speed, MAX_BLOCK_SLIDE_SPEED),
    });
  }, [gameAreaWidth, stackedBlocks.length]); // Dependencies for spawnNewBlock

  const initializeNewGameAttempt = useCallback(() => {
    setCurrentAttemptGold(0);
    setCurrentAttemptDiamonds(0);
    setConsecutivePerfectDrops(0);
    setAdsRevivesUsedThisAttempt(0);
    const baseBlock: StackedBlock = {
      id: 'base', x: (gameAreaWidth - INITIAL_BASE_WIDTH) / 2,
      y: GAME_AREA_HEIGHT - INITIAL_BLOCK_HEIGHT, width: INITIAL_BASE_WIDTH, color: 'hsl(var(--muted))',
    };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y, BLOCK_SLIDE_SPEED_START);
    setGameState('playing');
  }, [gameAreaWidth, spawnNewBlock]); // spawnNewBlock is a dependency

  const processAttemptOver = () => {
    // TODO: Backend - Save final score (currentAttemptGold, currentAttemptDiamonds, stackedBlocks.length -1)
    toast({
      title: "Attempt Over!",
      description: (
        <div className="flex flex-col gap-1">
            <span>Stacked: {stackedBlocks.length -1} blocks</span>
            <span className="flex items-center">Earned: <Coins className="h-4 w-4 mx-1 text-yellow-500" /> {currentAttemptGold} Gold</span>
           {currentAttemptDiamonds > 0 && <span className="flex items-center">Bonus: <Gem className="h-4 w-4 mx-1 text-sky-400" /> {currentAttemptDiamonds.toFixed(4)} Diamonds</span>}
        </div>
      ),
      variant: "default",
      duration: 5000,
    });
    setGameState('gameover_attempt');
  };
  
  const continueCurrentAttempt = useCallback(() => { 
    if (stackedBlocks.length > 0) {
        const topBlock = stackedBlocks[stackedBlocks.length -1];
        const currentSpeed = BLOCK_SLIDE_SPEED_START + ((stackedBlocks.length -1) * BLOCK_SLIDE_SPEED_INCREMENT);
        spawnNewBlock(topBlock.width, topBlock.y, Math.min(currentSpeed, MAX_BLOCK_SLIDE_SPEED));
        setGameState('playing');
    } else {
        initializeNewGameAttempt();
    }
  }, [stackedBlocks, spawnNewBlock, initializeNewGameAttempt]); // spawnNewBlock, initializeNewGameAttempt added


  const handleDropBlock = () => {
    if (gameState !== 'playing' || !currentBlock) return;
    setGameState('dropping'); // Brief state to prevent double drops, visual changes happen on next 'playing'
    setLastDropPerfect(false); // Reset perfect drop visual flag

    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    let newBlockX = currentBlock.x;
    let newBlockWidth = currentBlock.width;
    let gainedGoldThisDrop = 0;
    let gainedDiamondsThisDrop = 0;
    let isPerfectDrop = false;

    const overlapStart = Math.max(newBlockX, topStackBlock.x);
    const overlapEnd = Math.min(newBlockX + newBlockWidth, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth > MIN_BLOCK_WIDTH / 2) { // Need at least half of min width to consider it a successful drop
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      const perfectDropThreshold = 3; // Pixels leeway for a perfect drop
      if (Math.abs(currentBlock.x - topStackBlock.x) < perfectDropThreshold && Math.abs(currentBlock.width - topStackBlock.width) < perfectDropThreshold) {
        isPerfectDrop = true;
        setLastDropPerfect(true); // For one-time animation trigger
        newBlockX = topStackBlock.x; // Align perfectly
        newBlockWidth = topStackBlock.width; // Match width perfectly
        gainedGoldThisDrop = GOLD_FOR_PERFECT_DROP;
        
        const newConsecutivePerfects = consecutivePerfectDrops + 1;
        setConsecutivePerfectDrops(newConsecutivePerfects);
        toast({ description: <span className="flex items-center"><Star className="h-4 w-4 mr-1 text-yellow-300 fill-yellow-300"/> Perfect Drop! +{GOLD_FOR_PERFECT_DROP} Gold</span>, duration: 1500 });


        if (newConsecutivePerfects >= 3) {
          gainedDiamondsThisDrop = DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS;
          setCurrentAttemptDiamonds(d => d + gainedDiamondsThisDrop);
          setConsecutivePerfectDrops(0); // Reset after 3
          toast({ description: <span className="flex items-center"><Gem className="h-4 w-4 mr-1 text-sky-400"/> Triple Perfect! +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS.toFixed(4)} Diamonds</span>, duration: 2500, className: "bg-sky-500/20 border-sky-500" });
        }
      } else {
        gainedGoldThisDrop = GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP;
        setConsecutivePerfectDrops(0); // Reset if not perfect
        toast({ description: <span className="flex items-center"><Coins className="h-4 w-4 mr-1 text-yellow-500"/> +{GOLD_FOR_SUCCESSFUL_NON_PERFECT_DROP} Gold</span>, duration: 1500 });
      }
      setCurrentAttemptGold(s => s + gainedGoldThisDrop);
      // TODO: Backend - Update user's Gold/Diamond balance immediately or queue for end of game

      if (newBlockWidth < MIN_BLOCK_WIDTH) { // Game over if block is too small
        processAttemptOver(); return;
      }

      const newStackedBlock: StackedBlock = {
        id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: topStackBlock.y - INITIAL_BLOCK_HEIGHT,
        width: newBlockWidth, color: currentBlock.color, isPerfect: isPerfectDrop,
      };
      
      const newStack = [...stackedBlocks, newStackedBlock];
      // Mark only the newly added block as perfect for animation trigger
      setStackedBlocks(newStack.map(b => ({...b, isPerfect: b.id === newStackedBlock.id ? isPerfectDrop : false })));


      // Scroll view up if stack is high
      if (newStackedBlock.y < GAME_AREA_HEIGHT / 2.5 && newStack.length > 5) { // Start scrolling after 5 blocks & past halfway
        setStackedBlocks(prev => prev.map(b => ({ ...b, y: b.y + INITIAL_BLOCK_HEIGHT })));
      }
      const nextSpeed = BLOCK_SLIDE_SPEED_START + (newStack.length * BLOCK_SLIDE_SPEED_INCREMENT);
      spawnNewBlock(newBlockWidth, newStackedBlock.y, nextSpeed);
      setGameState('playing'); // Return to playing state for next block
    } else { // Missed completely or overlap too small
      processAttemptOver();
    }
  };

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock) {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      return;
    }
    setCurrentBlock(prev => {
      if (!prev) return null;
      let newX = prev.x + prev.direction * prev.speed;
      // Boundary collision and direction change
      if ((newX + prev.width > gameAreaWidth && prev.direction === 1) || (newX < 0 && prev.direction === -1)) {
        const nextX = prev.direction === 1 ? gameAreaWidth - prev.width : 0;
        return { ...prev, x: nextX, direction: prev.direction * -1 as (1 | -1) };
      }
      return { ...prev, x: newX };
    });
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, currentBlock, gameAreaWidth]); // currentBlock is in deps, gameLoop uses its value for calculation logic, not just for prev state

  useEffect(() => {
    if (gameState === 'playing' && currentBlock) {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); // Ensure only one loop runs
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    // Cleanup function to cancel animation frame when component unmounts or dependencies change
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [gameState, gameLoop, currentBlock]); // currentBlock dependency ensures loop restarts if block changes

  const handleWatchAdForOption = (purpose: 'revive_attempt' | 'gain_pooled_heart') => {
    if (purpose === 'revive_attempt' && adsRevivesUsedThisAttempt >= MAX_ADS_REVIVES_PER_ATTEMPT) {
      toast({ title: "Ad Revive Limit Reached", description: "No more ad revives for this attempt.", variant: "default" });
      return;
    }
    if (purpose === 'gain_pooled_heart' && pooledHearts >= MAX_POOLED_HEARTS) {
        toast({ title: "Hearts Full", description: "You already have the maximum number of hearts.", variant: "default"});
        return;
    }
    // TODO: Backend - Check if user is eligible for ad reward (e.g., daily limits from server)
    setAdPurpose(purpose);
    setAdTimer(AD_REVIVE_DURATION_S);
    setAdProgress(0); // Reset progress for new ad
    setIsAdDialogOpen(true);
    setGameState('ad_viewing');
  };

  useEffect(() => {
    let adViewTimerId: NodeJS.Timeout | undefined;
    if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer > 0) {
      adViewTimerId = setTimeout(() => {
        setAdTimer(prev => prev - 1);
        setAdProgress(prev => Math.min(prev + (100 / AD_REVIVE_DURATION_S), 100));
      }, 1000);
    } else if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer === 0) {
      setIsAdDialogOpen(false);
      setAdProgress(100); // Ensure progress shows 100%
      // TODO: Backend - Call API to confirm ad view and grant reward server-side
      if (adPurpose === 'revive_attempt') {
        setAdsRevivesUsedThisAttempt(prev => prev + 1);
        continueCurrentAttempt(); // Continue game
        toast({ description: "Attempt continued after Ad!", className: "bg-green-600 border-green-700 text-white dark:bg-green-600 dark:text-white" });
      } else if (adPurpose === 'gain_pooled_heart') {
        setPooledHearts(prev => {
            const newHearts = Math.min(prev + 1, MAX_POOLED_HEARTS);
            if (newHearts < MAX_POOLED_HEARTS && !nextHeartRegenTime) setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS);
            else if (newHearts === MAX_POOLED_HEARTS) setNextHeartRegenTime(null);
            // TODO: Backend - Update heart count and next regen time on server
            return newHearts;
        });
        toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> +1 Heart gained from Ad!</span> });
        setGameState(pooledHearts +1 > 0 ? 'idle' : 'waiting_for_hearts'); // Return to appropriate state
      }
      setAdPurpose(null); // Reset ad purpose
      setAdTimer(AD_REVIVE_DURATION_S); // Reset ad timer for next use
      setAdProgress(0); // Reset progress for next use
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adPurpose, continueCurrentAttempt, toast, nextHeartRegenTime, pooledHearts]);

  const closeAdDialogEarly = () => {
    setIsAdDialogOpen(false);
    if (adPurpose === 'revive_attempt') setGameState('gameover_attempt'); // If reviving, game over
    else if (adPurpose === 'gain_pooled_heart') setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts'); // Back to idle/waiting
    setAdPurpose(null);
    setAdTimer(AD_REVIVE_DURATION_S);
    setAdProgress(0);
    toast({ title: "Ad Closed Early", description: "No reward granted.", variant: "destructive" });
  };
  
  const handleSpendDiamondsToContinue = () => {
    // TODO: Backend - Verify diamond balance and deduct server-side
    // For now, using mock client-side balance
    const cost = 0.05; // Example cost
    if (mockUserDiamondBalance >= cost) {
        const newSimulatedBalance = mockUserDiamondBalance - cost;
        setMockUserDiamondBalance(newSimulatedBalance); 
        localStorage.setItem(LOCALSTORAGE_MOCK_DIAMOND_BALANCE_KEY, newSimulatedBalance.toString()); 

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
  };


  const handleReturnToMainMenu = () => { setGameState('idle'); }

  const canReviveWithAd = adsRevivesUsedThisAttempt < MAX_ADS_REVIVES_PER_ATTEMPT;
  const canContinueWithDiamonds = mockUserDiamondBalance >= 0.05; // Example condition
  const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS;

  // Function to determine displayed score or game title
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
    return <span className="text-slate-400">Stake Builder</span>; // Default title when idle
  };

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height)-var(--bottom-nav-height,0px))] md:min-h-[calc(100vh-var(--header-height))] pt-2 pb-2 md:pt-4 md:pb-4 bg-gradient-to-br from-slate-900 via-purple-900/40 to-slate-900 text-slate-100 overflow-hidden">
        <div
            className="flex flex-col items-center w-full max-w-sm mx-auto p-2 sm:p-4 bg-slate-800/70 text-slate-100 rounded-xl shadow-2xl border-2 border-primary/30 relative overflow-hidden backdrop-blur-sm"
            onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={0}
            aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
            onKeyDown={(e) => { if (e.key === ' ' || e.code === 'Space') gameState === 'playing' && handleDropBlock(); }}
        >
          {/* Header: Score and Hearts */}
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

          {/* Heart Regen Timer */}
          {(gameState === 'idle' || gameState === 'waiting_for_hearts') && pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && (
            <div className="w-full text-center py-2 px-3 bg-slate-900/60 rounded-md mb-3 text-sm shadow">
                <p className="text-yellow-300 font-medium">Next <Heart className="inline h-4 w-4 text-red-400 fill-red-400" /> in: {timeToNextHeart}</p>
            </div>
          )}

          {/* Game Area */}
          <div
            ref={gameAreaRef} className="relative bg-black/50 border-2 border-slate-700/80 rounded-md overflow-hidden shadow-inner"
            style={{ 
                height: `${GAME_AREA_HEIGHT}px`, 
                width: `${gameAreaWidth}px`,
                backgroundImage: 'linear-gradient(180deg, hsl(var(--primary)/0.2) 0%, hsl(var(--accent)/0.1) 40%, hsl(var(--background)) 100%)',
                cursor: gameState === 'playing' ? 'pointer' : 'default' 
            }}
          >
            {stackedBlocks.map(block => (
              <div key={block.id}
                className={cn("absolute rounded-sm", // Removed shadow-lg
                  block.isPerfect && "ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/50" // Removed continuous animation, static ring instead
                )}
                style={{ 
                    left: `${block.x}px`, top: `${block.y}px`, width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`,
                    backgroundColor: block.color, border: `1px solid ${block.id === 'base' ? 'hsl(var(--muted))' : 'hsl(var(--border))'}`,
                }}
              />
            ))}
            {currentBlock && (gameState === 'playing' || gameState === 'dropping') && (
              <div className="absolute rounded-sm border border-white/20" // Removed shadow-xl
                style={{ 
                    left: `${currentBlock.x}px`, top: `${currentBlock.y}px`, width: `${currentBlock.width}px`,
                    height: `${INITIAL_BLOCK_HEIGHT}px`, backgroundColor: currentBlock.color,
                }}
              />
            )}

            {/* Game State Overlays (Idle, Game Over, Waiting for Hearts) */}
            {(gameState === 'idle' || gameState === 'gameover_attempt' || gameState === 'waiting_for_hearts') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm z-10 p-4 text-center space-y-4">
                {gameState === 'idle' && (
                  <>
                    <GameIcon size={64} className="text-primary mb-2 animate-[pulse-glow_2s_infinite]" />
                    <h2 className="text-4xl font-bold mb-1 text-slate-100 font-headline">Stake Builder</h2>
                    <p className="text-slate-300 mb-4 max-w-xs">Tap to drop. Stack 'em high! {pooledHearts} {pooledHearts === 1 ? "heart" : "hearts"} left.</p>
                    { pooledHearts > 0 ? (
                        <Button onClick={startGameAttempt} size="xl" className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground text-xl px-10 py-6 rounded-lg shadow-xl transform hover:scale-105 transition-transform duration-150">
                            <Play className="mr-3 h-7 w-7" /> Start (-1 <Heart className="inline h-5 w-5 fill-current" />)
                        </Button>
                    ) : (
                        <Button disabled size="xl" className="text-xl px-10 py-6 rounded-lg shadow-lg">
                            <Heart className="mr-3 h-7 w-7 text-slate-500" /> No Hearts
                        </Button>
                    )}
                    {canWatchAdForPooledHeart && (
                        <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} variant="outline" size="lg" className="w-full max-w-xs mt-3 border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                          <Tv className="mr-2 h-5 w-5" /> Watch Ad for +1 <Heart className="inline h-4 w-4 fill-current"/>
                        </Button>
                    )}
                     <p className="text-xs text-muted-foreground mt-4">
                      Perfect Drop: +{GOLD_FOR_PERFECT_DROP} Gold | 3x Perfect: +{DIAMONDS_FOR_THREE_CONSECUTIVE_PERFECT_DROPS} Diamonds
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
                            <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} variant="outline" size="lg" className="w-full max-w-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
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
                        <Button onClick={() => handleWatchAdForOption('revive_attempt')} variant="outline" size="lg" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                          <Tv className="mr-2 h-5 w-5" /> Ad to Continue ({MAX_ADS_REVIVES_PER_ATTEMPT - adsRevivesUsedThisAttempt} left)
                        </Button>
                      )}
                      {canContinueWithDiamonds && ( // Placeholder for diamond continue
                         <Button onClick={handleSpendDiamondsToContinue} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-slate-900 transition-colors">
                            <Gem className="mr-2 h-5 w-5" /> Use {0.05} <Gem className="inline h-3 w-3"/> to Continue
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

          {/* Ad Simulation Dialog */}
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
