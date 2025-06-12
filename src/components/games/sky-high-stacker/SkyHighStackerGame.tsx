
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Heart, Play, Tv, RefreshCw as TryAgainIcon, Layers as GameIcon, AlertTriangle, Info, Coins, Gem } from 'lucide-react'; // Loader2 removed as not used
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image'; // For Ad Dialog

const GAME_AREA_WIDTH_BASE = 320;
const GAME_AREA_HEIGHT = 550;
const INITIAL_BLOCK_HEIGHT = 20;
const INITIAL_BASE_WIDTH = 120;
const MIN_BLOCK_WIDTH = 10;

const MAX_POOLED_HEARTS = 3; 
const GOLD_PER_BLOCK = 10;
const PERFECT_DROP_BONUS_GOLD = 5;

const MAX_ADS_REVIVES_PER_ATTEMPT = 1; // Max ad revives per single game attempt (not session)
const AD_REVIVE_DURATION_S = 5; 
const HEART_REGEN_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours per heart

const DIAMONDS_TO_CONTINUE_ATTEMPT = 0.008;
const MIN_DIAMONDS_FROM_GAME_SCORE = 0.005;
const GAME_SCORE_TO_DIAMOND_CONVERSION_RATE = 0.0003; 

const BLOCK_COLORS = [
  'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
  'hsl(var(--accent))',
];

const BLOCK_SLIDE_SPEED_START = 1.5;
const BLOCK_SLIDE_SPEED_INCREMENT = 0.05; 
const MAX_BLOCK_SLIDE_SPEED = 5;


// LocalStorage Keys
const LOCALSTORAGE_POOLED_HEARTS_KEY = 'skyHighStacker_pooledHearts_v5';
const LOCALSTORAGE_NEXT_HEART_REGEN_KEY = 'skyHighStacker_nextHeartRegenTime_v5';
// Removed LOCALSTORAGE_ADS_REVIVES_SESSION_KEY, now per attempt

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

export default function SkyHighStackerGame() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'dropping' | 'gameover_attempt' | 'ad_viewing' | 'waiting_for_hearts'>('idle');
  
  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [pooledHearts, setPooledHearts] = useState(MAX_POOLED_HEARTS);
  const [nextHeartRegenTime, setNextHeartRegenTime] = useState<number | null>(null);
  const [timeToNextHeart, setTimeToNextHeart] = useState<string>("");

  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);

  const [adsRevivesUsedThisAttempt, setAdsRevivesUsedThisAttempt] = useState(0);
  const [isAdDialogOpen, setIsAdDialogOpen] = useState(false);
  const [adTimer, setAdTimer] = useState(AD_REVIVE_DURATION_S);
  const [adPurpose, setAdPurpose] = useState<'revive_attempt' | 'gain_pooled_heart' | null>(null);

  const [currentUserDiamondBalance, setCurrentUserDiamondBalance] = useState(0.1); 

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const { toast } = useToast();

  const getGameAreaWidth = useCallback(() => {
    if (typeof window !== 'undefined') return Math.min(window.innerWidth * 0.9, GAME_AREA_WIDTH_BASE);
    return GAME_AREA_WIDTH_BASE;
  }, []);
  const [gameAreaWidth, setGameAreaWidth] = useState(getGameAreaWidth());

  useEffect(() => {
    const handleResize = () => setGameAreaWidth(getGameAreaWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getGameAreaWidth]);

  useEffect(() => {
    const savedHearts = localStorage.getItem(LOCALSTORAGE_POOLED_HEARTS_KEY);
    setPooledHearts(savedHearts !== null ? Math.min(parseInt(savedHearts, 10), MAX_POOLED_HEARTS) : MAX_POOLED_HEARTS);

    const savedRegenTime = localStorage.getItem(LOCALSTORAGE_NEXT_HEART_REGEN_KEY);
    setNextHeartRegenTime(savedRegenTime !== null ? parseInt(savedRegenTime, 10) : null);
    
    // TODO: Fetch actual diamond balance from user data instead of mock
    const mockBalance = parseFloat(localStorage.getItem('mockDiamondBalance_skyhighstacker') || '0.1');
    setCurrentUserDiamondBalance(mockBalance);

  }, []);

  useEffect(() => { localStorage.setItem(LOCALSTORAGE_POOLED_HEARTS_KEY, pooledHearts.toString()); }, [pooledHearts]);
  useEffect(() => {
    if (nextHeartRegenTime !== null) localStorage.setItem(LOCALSTORAGE_NEXT_HEART_REGEN_KEY, nextHeartRegenTime.toString());
    else localStorage.removeItem(LOCALSTORAGE_NEXT_HEART_REGEN_KEY);
  }, [nextHeartRegenTime]);

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
    } else if (pooledHearts === MAX_POOLED_HEARTS && nextHeartRegenTime !== null) {
      setNextHeartRegenTime(null);
      setTimeToNextHeart("");
    }
    return () => clearInterval(intervalId);
  }, [pooledHearts, nextHeartRegenTime, gameState]);

  const initializeNewGameAttempt = useCallback(() => {
    setCurrentAttemptGold(0);
    setAdsRevivesUsedThisAttempt(0); // Reset ad revives for new attempt
    const baseBlock: StackedBlock = {
      id: 'base', x: (gameAreaWidth - INITIAL_BASE_WIDTH) / 2,
      y: GAME_AREA_HEIGHT - INITIAL_BLOCK_HEIGHT, width: INITIAL_BASE_WIDTH, color: 'hsl(var(--muted))',
    };
    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y, BLOCK_SLIDE_SPEED_START);
    setGameState('playing');
  }, [gameAreaWidth]);

  const startGameAttempt = () => {
    if (pooledHearts > 0) {
      setPooledHearts(h => {
        const newHearts = h - 1;
        if (newHearts < MAX_POOLED_HEARTS && nextHeartRegenTime === null) {
          setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS);
        }
        return newHearts;
      });
      initializeNewGameAttempt();
    } else {
      setGameState('waiting_for_hearts');
    }
  };

  const spawnNewBlock = (currentTopWidth: number, currentTopY: number, speed: number) => {
    const newBlockWidth = currentTopWidth;
    setCurrentBlock({
      x: Math.random() < 0.5 ? -newBlockWidth : gameAreaWidth,
      y: currentTopY - INITIAL_BLOCK_HEIGHT - 5, width: newBlockWidth,
      color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)],
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: Math.min(speed, MAX_BLOCK_SLIDE_SPEED),
    });
  };

  const processAttemptOver = () => {
    // TODO: Backend - Send currentAttemptGold and calculate diamondsFromScore on backend
    let diamondsFromScore = currentAttemptGold * GAME_SCORE_TO_DIAMOND_CONVERSION_RATE;
    if (diamondsFromScore > 0 && diamondsFromScore < MIN_DIAMONDS_FROM_GAME_SCORE) {
      diamondsFromScore = MIN_DIAMONDS_FROM_GAME_SCORE;
    } else if (diamondsFromScore <= 0) {
        diamondsFromScore = 0;
    }

    toast({
      title: "Attempt Over!",
      description: (
        <div className="flex flex-col gap-1">
            <span>Stacked: {stackedBlocks.length -1} blocks</span>
            <span className="flex items-center">Earned: <Coins className="h-4 w-4 mx-1 text-yellow-400" /> {currentAttemptGold} Gold</span>
           {diamondsFromScore > 0 && <span className="flex items-center">Bonus: <Gem className="h-4 w-4 mx-1 text-sky-400" /> {diamondsFromScore.toFixed(4)} Diamonds</span>}
           <span className="text-xs text-muted-foreground">(Rewards are simulated & subject to backend processing)</span>
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
        const currentSpeed = BLOCK_SLIDE_SPEED_START + ((stackedBlocks.length -1) * GOLD_PER_BLOCK * BLOCK_SLIDE_SPEED_INCREMENT / 200); 
        spawnNewBlock(topBlock.width, topBlock.y, Math.min(currentSpeed, MAX_BLOCK_SLIDE_SPEED));
        setGameState('playing');
    } else {
        initializeNewGameAttempt(); // Should not happen if continuing, but as a fallback
    }
  }, [stackedBlocks, initializeNewGameAttempt]);


  const handleDropBlock = () => {
    if (gameState !== 'playing' || !currentBlock) return;
    setGameState('dropping'); // Visual state for drop, actual logic below handles placement

    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    let newBlockX = currentBlock.x;
    let newBlockWidth = currentBlock.width;
    let isPerfect = false;

    const overlapStart = Math.max(newBlockX, topStackBlock.x);
    const overlapEnd = Math.min(newBlockX + newBlockWidth, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth > MIN_BLOCK_WIDTH / 2) { 
      newBlockX = overlapStart;
      newBlockWidth = overlapWidth;

      const perfectDropThreshold = 2; // Pixels
      if (Math.abs(currentBlock.x - topStackBlock.x) < perfectDropThreshold && Math.abs(currentBlock.width - topStackBlock.width) < perfectDropThreshold) {
        isPerfect = true; newBlockX = topStackBlock.x; newBlockWidth = topStackBlock.width; // Snap to perfect
        toast({ description: <span className="flex items-center"><Coins className="h-4 w-4 mr-1 text-yellow-500"/> +{PERFECT_DROP_BONUS_GOLD} Gold (Perfect!)</span>, duration: 1500 });
        setCurrentAttemptGold(s => s + PERFECT_DROP_BONUS_GOLD);
        // TODO: Backend - Increment perfect stack counter for potential diamond bonus
      }

      if (newBlockWidth < MIN_BLOCK_WIDTH) { // Check if block is too small after calculating new width
        processAttemptOver(); return;
      }

      const newStackedBlock: StackedBlock = {
        id: `block-${Date.now()}-${Math.random()}`, x: newBlockX, y: topStackBlock.y - INITIAL_BLOCK_HEIGHT,
        width: newBlockWidth, color: currentBlock.color, isPerfect,
      };
      setStackedBlocks(prev => [...prev, newStackedBlock]);
      setCurrentAttemptGold(s => s + GOLD_PER_BLOCK);

      // Scroll view if tower gets high
      if (newStackedBlock.y < GAME_AREA_HEIGHT / 3 && gameAreaRef.current) {
         setStackedBlocks(prev => prev.map(b => ({ ...b, y: b.y + INITIAL_BLOCK_HEIGHT })));
      }
      
      const nextSpeed = BLOCK_SLIDE_SPEED_START + (stackedBlocks.length * BLOCK_SLIDE_SPEED_INCREMENT / 10);
      spawnNewBlock(newBlockWidth, newStackedBlock.y, nextSpeed); // Spawn next block based on current placed block's Y
      setGameState('playing');
    } else {
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
      if ((newX + prev.width > gameAreaWidth && prev.direction === 1) || (newX < 0 && prev.direction === -1)) {
        return { ...prev, x: prev.direction === 1 ? gameAreaWidth - prev.width : 0, direction: prev.direction * -1 as (1 | -1) };
      }
      return { ...prev, x: newX };
    });
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, currentBlock, gameAreaWidth]);

  useEffect(() => {
    if (gameState === 'playing' && currentBlock) gameLoopRef.current = requestAnimationFrame(gameLoop);
    else if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [gameState, gameLoop, currentBlock]);

  const handleWatchAdForOption = (purpose: 'revive_attempt' | 'gain_pooled_heart') => {
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
    setIsAdDialogOpen(true);
    setGameState('ad_viewing');
  };

  useEffect(() => {
    let adViewTimerId: NodeJS.Timeout | undefined;
    if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer > 0) {
      adViewTimerId = setTimeout(() => setAdTimer(prev => prev - 1), 1000);
    } else if (gameState === 'ad_viewing' && isAdDialogOpen && adTimer === 0) {
      setIsAdDialogOpen(false);
      // TODO: Backend - Verify ad completion and grant reward
      if (adPurpose === 'revive_attempt') {
        setAdsRevivesUsedThisAttempt(prev => prev + 1);
        continueCurrentAttempt();
        toast({ description: "Attempt continued after Ad!", className: "bg-green-500 text-white dark:bg-green-500 dark:text-black" });
      } else if (adPurpose === 'gain_pooled_heart') {
        setPooledHearts(prev => {
            const newHearts = Math.min(prev + 1, MAX_POOLED_HEARTS);
            if (newHearts < MAX_POOLED_HEARTS && !nextHeartRegenTime) setNextHeartRegenTime(Date.now() + HEART_REGEN_DURATION_MS);
            else if (newHearts === MAX_POOLED_HEARTS) {
                setNextHeartRegenTime(null);
            }
            return newHearts;
        });
        toast({ description: <span className="flex items-center"><Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400"/> +1 Heart gained from Ad!</span> });
        setGameState(pooledHearts +1 > 0 ? 'idle' : 'waiting_for_hearts');
      }
      setAdPurpose(null);
      setAdTimer(AD_REVIVE_DURATION_S); 
    }
    return () => clearTimeout(adViewTimerId);
  }, [gameState, isAdDialogOpen, adTimer, adPurpose, continueCurrentAttempt, toast, nextHeartRegenTime, pooledHearts]);

  const closeAdDialogEarly = () => {
    setIsAdDialogOpen(false);
    if (adPurpose === 'revive_attempt') setGameState('gameover_attempt');
    else if (adPurpose === 'gain_pooled_heart') setGameState(pooledHearts > 0 ? 'idle' : 'waiting_for_hearts');
    setAdPurpose(null);
    setAdTimer(AD_REVIVE_DURATION_S);
    toast({ title: "Ad Closed Early", description: "No reward granted.", variant: "destructive" });
  };
  
  const handleSpendDiamondsToContinue = () => {
    // TODO: Backend - Verify diamond balance and deduct diamonds
    if (currentUserDiamondBalance >= DIAMONDS_TO_CONTINUE_ATTEMPT) {
        const newSimulatedBalance = currentUserDiamondBalance - DIAMONDS_TO_CONTINUE_ATTEMPT;
        setCurrentUserDiamondBalance(newSimulatedBalance); 
        localStorage.setItem('mockDiamondBalance_skyhighstacker', newSimulatedBalance.toString()); 

        toast({
            description: (
                <span className="flex items-center">
                    <Gem className="h-4 w-4 mr-1 text-sky-400" /> -{DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} Diamonds spent. Attempt continued! (Simulated)
                </span>
            ),
        });
        continueCurrentAttempt();
    } else {
        toast({ title: "Not Enough Diamonds", description: `You need ${DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} diamonds to continue. Your balance: ${currentUserDiamondBalance.toFixed(3)}`, variant: "destructive"});
    }
  };


  const handleReturnToMainMenu = () => { setGameState('idle'); }

  const canReviveWithAd = adsRevivesUsedThisAttempt < MAX_ADS_REVIVES_PER_ATTEMPT;
  const canContinueWithDiamonds = currentUserDiamondBalance >= DIAMONDS_TO_CONTINUE_ATTEMPT;
  // const canWatchAdForPooledHeart = pooledHearts < MAX_POOLED_HEARTS; // already handled in button display logic

  return (
    <div
        className="flex flex-col items-center w-full max-w-md mx-auto p-1 sm:p-4 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border-2 border-primary/50 relative overflow-hidden select-none"
        onClick={gameState === 'playing' ? handleDropBlock : undefined} role="button" tabIndex={0}
        aria-label={gameState === 'playing' ? "Drop Block" : "Game Area"}
        onKeyDown={(e) => { if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if(gameState === 'playing') handleDropBlock();} }}
    >
      <div className="flex justify-between items-center w-full mb-3 px-3 py-3 bg-slate-800/70 rounded-t-lg">
        <div className="text-xl font-bold flex items-center gap-1">
            <Coins className="text-yellow-400 h-6 w-6" /> 
            <span className="text-yellow-400 tabular-nums">{currentAttemptGold}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
            <Heart key={`life-${i}`} className={cn("h-7 w-7 transition-all duration-300", i < pooledHearts ? "text-red-500 fill-red-500 animate-pulse-glow" : "text-slate-600")} />
          ))}
        </div>
      </div>

      {(gameState === 'idle' || gameState === 'waiting_for_hearts') && pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && (
        <div className="w-full text-center py-2 px-3 bg-slate-800/50 rounded-md mb-3 text-sm">
            <p className="text-yellow-400">Next heart in: {timeToNextHeart}</p>
        </div>
      )}

      <div
        ref={gameAreaRef} className="relative bg-black border-2 border-slate-700 rounded-md overflow-hidden shadow-inner"
        style={{ height: `${GAME_AREA_HEIGHT}px`, width: `${gameAreaWidth}px`,
                 backgroundImage: 'linear-gradient(to bottom, hsl(var(--background)) 70%, hsl(var(--primary) / 0.3))',
                 cursor: gameState === 'playing' ? 'pointer' : 'default' }}
      >
        {stackedBlocks.map(block => (
          <div key={block.id}
            className={cn("absolute rounded-sm shadow-md", block.isPerfect && "outline outline-2 outline-offset-1 outline-yellow-300 animate-pulse")}
            style={{ left: `${block.x}px`, top: `${block.y}px`, width: `${block.width}px`, height: `${INITIAL_BLOCK_HEIGHT}px`,
                     backgroundColor: block.color, border: `1px solid ${block.id === 'base' ? 'hsl(var(--border))' : 'rgba(0,0,0,0.2)'}`,
                     transition: 'top 0.1s linear, left 0.1s linear, width 0.1s linear, outline 0.3s ease-in-out' }}
          />
        ))}
        {currentBlock && (gameState === 'playing' || gameState === 'dropping') && (
          <div className="absolute rounded-sm shadow-lg"
            style={{ left: `${currentBlock.x}px`, top: `${currentBlock.y}px`, width: `${currentBlock.width}px`,
                     height: `${INITIAL_BLOCK_HEIGHT}px`, backgroundColor: currentBlock.color, border: '1px solid rgba(0,0,0,0.3)' }}
          />
        )}

        {(gameState === 'idle' || gameState === 'gameover_attempt' || gameState === 'waiting_for_hearts') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm z-10 p-4 text-center">
            {gameState === 'idle' && (
              <>
                <GameIcon size={64} className="text-primary mb-6 animate-pulse" />
                <h2 className="text-4xl font-bold mb-2 text-slate-100 font-headline">Sky High Stacker</h2>
                <p className="text-slate-300 mb-6 max-w-xs">Tap to drop. Stack high! You have {pooledHearts} {pooledHearts === 1 ? "heart" : "hearts"}.</p>
                { pooledHearts > 0 ? (
                    <Button onClick={startGameAttempt} size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xl px-10 py-3 rounded-lg shadow-lg h-auto">
                        <Play className="mr-3 h-7 w-7" /> Start Game <span className="text-sm ml-1">(-1<Heart className="inline h-4 w-4 text-red-300 fill-red-300" />)</span>
                    </Button>
                ) : (
                    <Button disabled size="lg" className="text-xl px-10 py-3 rounded-lg shadow-lg h-auto">
                        <Heart className="mr-3 h-7 w-7 text-slate-500" /> No Hearts Left
                    </Button>
                )}
                {pooledHearts < MAX_POOLED_HEARTS && timeToNextHeart && <p className="text-yellow-400 mt-3 text-sm">Next heart: {timeToNextHeart}</p>}
                {pooledHearts < MAX_POOLED_HEARTS && ( 
                     <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} variant="outline" size="lg" className="w-full max-w-xs mt-4 border-yellow-400 text-yellow-400 hover:bg-yellow-400/90 hover:text-slate-900 h-auto py-2.5">
                      <Tv className="mr-2 h-5 w-5" /> Watch Ad for +1 <Heart className="inline h-4 w-4 text-red-300 fill-red-300 ml-1" />
                    </Button>
                )}
              </>
            )}
            {gameState === 'waiting_for_hearts' && (
                 <>
                    <Info size={48} className="text-sky-400 mb-4" />
                    <h2 className="text-3xl font-bold mb-2 text-sky-300 font-headline">Waiting for Hearts</h2>
                    <p className="text-xl mb-6 text-slate-200">
                        You have no hearts left.
                        {timeToNextHeart ? ` Next heart in: ${timeToNextHeart}` : " Calculating..."}
                    </p>
                     {pooledHearts < MAX_POOLED_HEARTS && (
                        <Button onClick={() => handleWatchAdForOption('gain_pooled_heart')} variant="outline" size="lg" className="w-full max-w-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400/90 hover:text-slate-900 h-auto py-2.5">
                        <Tv className="mr-2 h-5 w-5" /> Watch Ad for +1 <Heart className="inline h-4 w-4 text-red-300 fill-red-300 ml-1" />
                        </Button>
                    )}
                    <Button onClick={handleReturnToMainMenu} variant="secondary" size="lg" className="w-full max-w-xs mt-3 h-auto py-2.5"> Return to Menu </Button>
                 </>
            )}
            {gameState === 'gameover_attempt' && (
              <>
                 <AlertTriangle size={48} className="text-destructive mb-4" />
                <h2 className="text-3xl font-bold mb-2 text-destructive font-headline">Attempt Over!</h2>
                <p className="text-xl mb-1 text-slate-200">Stacked: <span className="font-bold text-slate-100">{stackedBlocks.length -1}</span></p>
                <p className="text-lg mb-1 text-slate-200">Gold: <span className="text-yellow-400 font-bold">{currentAttemptGold}</span></p>
                <p className="text-md mb-4 text-slate-300">Hearts Left: <span className={pooledHearts > 0 ? "text-green-400" : "text-red-400"}>{pooledHearts}</span></p>
                <div className="space-y-3 w-full max-w-xs">
                  {canReviveWithAd && (
                    <Button onClick={() => handleWatchAdForOption('revive_attempt')} variant="outline" size="lg" className="w-full border-yellow-400 text-yellow-400 hover:bg-yellow-400/90 hover:text-slate-900 h-auto py-2.5">
                      <Tv className="mr-2 h-5 w-5" /> Watch Ad to Continue ({MAX_ADS_REVIVES_PER_ATTEMPT - adsRevivesUsedThisAttempt} left)
                    </Button>
                  )}
                  {canContinueWithDiamonds && (
                     <Button onClick={handleSpendDiamondsToContinue} variant="outline" size="lg" className="w-full border-sky-400 text-sky-400 hover:bg-sky-400/90 hover:text-slate-900 h-auto py-2.5">
                        <Gem className="mr-2 h-5 w-5" /> Spend {DIAMONDS_TO_CONTINUE_ATTEMPT.toFixed(3)} to Continue
                     </Button>
                  )}
                  {(!canReviveWithAd && !canContinueWithDiamonds) && <p className="text-sm text-muted-foreground">No more continues available for this attempt.</p>}
                   <Button onClick={handleReturnToMainMenu} variant="secondary" size="lg" className="w-full h-auto py-2.5">
                     <TryAgainIcon className="mr-2 h-5 w-5" /> Main Menu / Next Attempt
                    </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
       {gameState === 'playing' && (
          <p className="text-xs text-center text-muted-foreground mt-3">Tap screen or press Space to Drop Block</p>
      )}

      {isAdDialogOpen && (
        <Dialog open={isAdDialogOpen} onOpenChange={(open) => { if (!open && gameState === 'ad_viewing') closeAdDialogEarly()}}>
          <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-yellow-400 font-headline"><Tv className="h-6 w-6"/> Watching Simulated Ad</DialogTitle>
              <DialogDescription className="text-slate-400">
                Wait for the timer to finish to {adPurpose === 'revive_attempt' ? 'continue your attempt' : 'gain a heart'}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 text-center space-y-4">
              <div className="w-full h-40 bg-slate-700 rounded-md flex items-center justify-center overflow-hidden">
                <Image src="https://placehold.co/300x150/1a202c/7DF9FF.png?text=Ad+Content" alt="Simulated Ad" width={300} height={150} data-ai-hint="advertisement video content" className="object-cover"/>
              </div>
              <p className="text-5xl font-bold text-yellow-400">{adTimer}s</p>
            </div>
            <DialogFooter>
              <Button onClick={closeAdDialogEarly} variant="destructive" className="w-full"> Close Ad (No Reward) </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

