'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Heart, Play, Tv, Coins, Gem, Loader2, Award, RefreshCw, Clock, MousePointerClick, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useAdsgram } from '@/hooks/useAdsgram';

// Game Constants
const GAME_TYPE_IDENTIFIER = 'stake-builder';
const MAX_POOLED_HEARTS = 5;
const INITIAL_BLOCK_HEIGHT = 20;
const INITIAL_BASE_WIDTH = 100;
const MIN_BLOCK_WIDTH = 10;
const GOLD_PER_DROP = 1;
const GOLD_PER_PERFECT_DROP = 5;
const DIAMONDS_PER_3_PERFECTS = 0.5;
const DIAMONDS_TO_CONTINUE = 1;
const MAX_DIAMOND_CONTINUES = 5;
const BLOCK_COLORS = [
  'hsl(var(--chart-1)/0.9)',
  'hsl(var(--chart-2)/0.9)',
  'hsl(var(--chart-3)/0.9)',
  'hsl(var(--chart-4)/0.9)',
  'hsl(var(--chart-5)/0.9)'
];
const SPEED_START = 2.0;
const SPEED_INCREMENT = 0.05;
const MAX_SPEED = 7.0;
const PERFECT_DROP_THRESHOLD = 2.5;
const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;
const ADSGRAM_STAKE_HEART_BLOCK_ID = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_STAKE_HEART || 'default-stake-heart-block-id';
const LOCAL_STORAGE_REPLENISH_KEY = 'hustleSoulHeartReplenish';

interface StackedBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  color: string;
  isPerfect?: boolean;
}

export default function GamePage() {
  const { currentUser, loadingUser, telegramAuthError, updateUserSession, fetchUserData } = useUser();
  const { toast } = useToast();

  // Game state management
  const [gameState, setGameState] = useState<'loading' | 'idle' | 'playing' | 'dropping' | 'gameover'>('loading');
  const [isApiLoading, setIsApiLoading] = useState(false);
  
  // Game stats
  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfects, setConsecutivePerfects] = useState(0);
  const [continuesUsed, setContinuesUsed] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [hearts, setHearts] = useState(0);
  const [replenishTimeLeft, setReplenishTimeLeft] = useState('');

  // Game mechanics
  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{
    x: number;
    y: number;
    width: number;
    color: string;
    direction: 1 | -1;
    speed: number;
  } | null>(null);
  const [stackOffsetY, setStackOffsetY] = useState(0);

  // Refs
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const [gameAreaSize, setGameAreaSize] = useState({ width: 0, height: 0 });
  const [isAdInProgress, setIsAdInProgress] = useState(false);

  // Initialize user data
  useEffect(() => {
    if (!loadingUser && currentUser) {
      setHearts(Math.min(currentUser.game_hearts?.[GAME_TYPE_IDENTIFIER] || 0, MAX_POOLED_HEARTS));
      setHighScore(currentUser.stake_builder_high_score || 0);
      setGameState('idle');
    } else if (!loadingUser && !currentUser) {
      setGameState('idle');
    }
  }, [currentUser, loadingUser]);

  // Measure game area
  useEffect(() => {
    const measureArea = () => {
      if (gameAreaRef.current) {
        const { clientWidth, clientHeight } = gameAreaRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setGameAreaSize({ width: clientWidth, height: clientHeight });
        }
      }
    };

    const observer = new ResizeObserver(measureArea);
    if (gameAreaRef.current) {
      observer.observe(gameAreaRef.current);
      measureArea();
    }

    return () => {
      if (gameAreaRef.current) observer.unobserve(gameAreaRef.current);
    };
  }, []);

  // Game loop
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock) {
      gameLoopRef.current = null;
      return;
    }

    setCurrentBlock(prev => {
      if (!prev) return null;
      
      let newX = prev.x + prev.direction * prev.speed;
      let newDirection = prev.direction;
      
      if (newX + prev.width > gameAreaSize.width) {
        newX = gameAreaSize.width - prev.width;
        newDirection = -1;
      } else if (newX < 0) {
        newX = 0;
        newDirection = 1;
      }
      
      return { ...prev, x: newX, direction: newDirection };
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, currentBlock, gameAreaSize.width]);

  // Start/stop game loop
  useEffect(() => {
    if (gameState === 'playing' && currentBlock && !gameLoopRef.current) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, gameLoop, currentBlock]);

  // Spawn new block
  const spawnNewBlock = useCallback((width: number, yPos: number) => {
    if (gameAreaSize.width === 0) return;

    const currentScore = Math.max(0, stackedBlocks.length - 1);
    const speed = Math.min(SPEED_START + (currentScore * SPEED_INCREMENT), MAX_SPEED);
    
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 : gameAreaSize.width - width,
      y: yPos - INITIAL_BLOCK_HEIGHT - 5,
      width,
      color: BLOCK_COLORS[stackedBlocks.length % BLOCK_COLORS.length],
      direction: Math.random() < 0.5 ? 1 : -1,
      speed
    });
  }, [gameAreaSize.width, stackedBlocks.length]);

  // Initialize new game
  const initializeNewGame = useCallback(() => {
    if (!gameAreaRef.current) return;

    const { clientWidth, clientHeight } = gameAreaRef.current;
    
    // Reset game state
    setCurrentAttemptGold(0);
    setCurrentAttemptDiamonds(0);
    setConsecutivePerfects(0);
    setContinuesUsed(0);
    setStackOffsetY(0);

    // Create base block
    const baseBlock = {
      id: 'base',
      x: (clientWidth - INITIAL_BASE_WIDTH) / 2,
      y: clientHeight - INITIAL_BLOCK_HEIGHT,
      width: INITIAL_BASE_WIDTH,
      color: 'hsl(var(--muted))'
    };

    setStackedBlocks([baseBlock]);
    spawnNewBlock(baseBlock.width, baseBlock.y);
    setGameState('playing');
  }, [spawnNewBlock]);

  // Start game
  const startGame = useCallback(async () => {
    if (!currentUser?.id || hearts <= 0 || isApiLoading || gameState !== 'idle') {
      if (hearts <= 0) {
        toast({
          title: "No Hearts Left!",
          description: "Watch an ad or wait for replenishment.",
          variant: "default"
        });
      }
      return;
    }

    setIsApiLoading(true);
    
    try {
      const response = await fetch('/api/games/use-heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          gameType: GAME_TYPE_IDENTIFIER
        })
      });

      const data = await response.json();

      if (data.success) {
        updateUserSession({ game_hearts: data.gameHearts });
        setHearts(data.remainingHearts);
        initializeNewGame();
      } else {
        toast({
          title: 'Failed to Start',
          description: data.error || 'Could not start game',
          variant: 'destructive'
        });
        fetchUserData(); // Sync with server
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Failed to connect to server',
        variant: 'destructive'
      });
    } finally {
      setIsApiLoading(false);
    }
  }, [currentUser, hearts, isApiLoading, gameState, toast, initializeNewGame, updateUserSession, fetchUserData]);

  // Drop block
  const dropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock) return;

    setGameState('dropping');
    
    const topBlock = stackedBlocks[stackedBlocks.length - 1];
    const overlapStart = Math.max(currentBlock.x, topBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, topBlock.x + topBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth < MIN_BLOCK_WIDTH) {
      endGame();
      return;
    }

    const xDiff = Math.abs(currentBlock.x - topBlock.x);
    const isPerfect = xDiff < PERFECT_DROP_THRESHOLD;
    let goldEarned = isPerfect ? GOLD_PER_PERFECT_DROP : GOLD_PER_DROP;
    let diamondsEarned = 0;

    if (isPerfect) {
      const newConsecutive = consecutivePerfects + 1;
      setConsecutivePerfects(newConsecutive);
      
      if (newConsecutive >= 3 && newConsecutive % 3 === 0) {
        diamondsEarned = DIAMONDS_PER_3_PERFECTS;
        toast({
          description: (
            <span className="flex items-center">
              <Gem className="h-4 w-4 mr-1 text-sky-400" />
              3x Perfect! +{diamondsEarned.toFixed(2)}💎
            </span>
          ),
          duration: 1500
        });
      }
    } else {
      setConsecutivePerfects(0);
    }

    setCurrentAttemptGold(prev => prev + goldEarned);
    setCurrentAttemptDiamonds(prev => prev + diamondsEarned);

    const newBlockWidth = isPerfect ? topBlock.width : overlapWidth;
    const newBlockX = isPerfect ? topBlock.x : overlapStart;
    const newBlockY = topBlock.y - INITIAL_BLOCK_HEIGHT;

    const newBlock = {
      id: `block-${Date.now()}`,
      x: newBlockX,
      y: newBlockY,
      width: newBlockWidth,
      color: currentBlock.color,
      isPerfect
    };

    setStackedBlocks(prev => [...prev, newBlock]);

    // Adjust view if stack gets too high
    if (newBlockY - stackOffsetY < gameAreaSize.height / 2.5) {
      setStackOffsetY(prev => prev + INITIAL_BLOCK_HEIGHT);
    }

    // Spawn next block after short delay
    setTimeout(() => {
      if (gameState === 'dropping') {
        spawnNewBlock(newBlockWidth, newBlockY - stackOffsetY);
        setGameState('playing');
      }
    }, 50);
  }, [
    gameState,
    currentBlock,
    stackedBlocks,
    consecutivePerfects,
    stackOffsetY,
    gameAreaSize.height,
    spawnNewBlock,
    toast
  ]);

  // End game
  const endGame = useCallback(async () => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    setCurrentBlock(null);
    const finalScore = Math.max(0, stackedBlocks.length - 1);

    if (currentUser?.id && (finalScore > 0 || currentAttemptGold > 0 || currentAttemptDiamonds > 0)) {
      setIsApiLoading(true);
      
      try {
        const response = await fetch('/api/games/submit-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            gameType: GAME_TYPE_IDENTIFIER,
            score: finalScore,
            goldEarned: currentAttemptGold,
            diamondEarned: currentAttemptDiamonds
          })
        });

        const data = await response.json();

        if (data.success) {
          updateUserSession({
            gold_points: data.totalGold,
            diamond_points: data.totalDiamonds
          });

          if (data.isHighScore) {
            setHighScore(finalScore);
            updateUserSession({ stake_builder_high_score: finalScore });
            toast({
              title: "New High Score!",
              description: `You reached ${finalScore} points!`,
              icon: <Award className="h-5 w-5 text-yellow-400" />
            });
          }
        }
      } catch (error) {
        toast({
          title: "Failed to Submit Score",
          variant: "destructive"
        });
      } finally {
        setIsApiLoading(false);
      }
    }

    setGameState('gameover');
  }, [
    currentUser,
    stackedBlocks.length,
    currentAttemptGold,
    currentAttemptDiamonds,
    updateUserSession,
    toast
  ]);

  // Continue with diamonds
  const continueWithDiamonds = async () => {
    if (!currentUser?.id || isApiLoading) return;
    if ((currentUser.diamond_points ?? 0) < DIAMONDS_TO_CONTINUE) {
      toast({
        title: "Not Enough Diamonds",
        variant: "destructive"
      });
      return;
    }

    setIsApiLoading(true);
    
    try {
      const response = await fetch('/api/games/spend-diamonds-to-continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          diamondsToSpend: DIAMONDS_TO_CONTINUE
        })
      });

      const data = await response.json();

      if (data.success) {
        updateUserSession({ diamond_points: data.newDiamondBalance });
        setContinuesUsed(prev => prev + 1);
        
        if (stackedBlocks.length > 0) {
          const topBlock = stackedBlocks[stackedBlocks.length - 1];
          spawnNewBlock(topBlock.width, topBlock.y - stackOffsetY);
          setGameState('playing');
        } else {
          initializeNewGame();
        }
      } else {
        throw new Error(data.error || 'Failed to continue');
      }
    } catch (error: any) {
      toast({
        title: "Failed to Continue",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsApiLoading(false);
    }
  };

  // Watch ad for heart
  const watchAdForHeart = useCallback(async () => {
    if (!currentUser || isAdInProgress || hearts >= MAX_POOLED_HEARTS) return;

    setIsAdInProgress(true);
    
    try {
      const onReward = () => {
        toast({
          title: "Ad Watched!",
          description: (
            <span className="flex items-center">
              <Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" />
              Heart reward processing...
            </span>
          )
        });
        setTimeout(fetchUserData, 3000);
      };

      const onClose = () => setIsAdInProgress(false);
      
      // Assuming useAdsgram is a hook that shows the ad
      const showAd = useAdsgram({
        blockId: ADSGRAM_STAKE_HEART_BLOCK_ID,
        onReward,
        onError: onClose,
        onClose
      });

      await showAd();
    } catch (error) {
      toast({
        title: "Ad Failed",
        description: "Could not load the ad",
        variant: "destructive"
      });
      setIsAdInProgress(false);
    }
  }, [currentUser, hearts, isAdInProgress, toast, fetchUserData]);

  // Replenish hearts
  const replenishHearts = async () => {
    if (!currentUser?.id || isApiLoading) return;

    setIsApiLoading(true);
    
    try {
      const response = await fetch('/api/games/replenish-hearts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: "Hearts Replenished!" });
        updateUserSession({
          game_hearts: data.hearts,
          last_heart_replenished: data.nextReplenish
        });
        setHearts(Math.min(data.hearts[GAME_TYPE_IDENTIFIER] || 0, MAX_POOLED_HEARTS));
        localStorage.setItem(LOCAL_STORAGE_REPLENISH_KEY, data.nextReplenish);
      } else {
        toast({
          title: "Not Ready Yet",
          description: data.message || "Cannot replenish hearts yet"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to replenish hearts",
        variant: "destructive"
      });
    } finally {
      setIsApiLoading(false);
    }
  };

  // Replenish timer
  useEffect(() => {
    const lastReplenish = currentUser?.last_heart_replenished || 
                         localStorage.getItem(LOCAL_STORAGE_REPLENISH_KEY);

    if (!lastReplenish || hearts >= MAX_POOLED_HEARTS) {
      setReplenishTimeLeft('');
      return;
    }

    const interval = setInterval(() => {
      const nextReplenish = new Date(lastReplenish).getTime() + THREE_HOURS_IN_MS;
      const diff = nextReplenish - Date.now();

      if (diff <= 0) {
        setReplenishTimeLeft('Ready!');
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
        setReplenishTimeLeft(`${hours}:${minutes}:${seconds}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser?.last_heart_replenished, hearts]);

  // Render game content
  const renderGameContent = () => {
    switch (gameState) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading game...</p>
          </div>
        );

      case 'playing':
      case 'dropping':
        return (
          <div 
            className="relative w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl overflow-hidden"
            onClick={dropBlock}
          >
            {/* Stacked blocks */}
            <div style={{ transform: `translateY(${stackOffsetY}px)` }}>
              {stackedBlocks.map(block => (
                <div
                  key={block.id}
                  className={cn(
                    "absolute rounded-sm border",
                    block.isPerfect ? "ring-2 ring-yellow-300" : "",
                    block.id === 'base' ? "border-muted-foreground/50" : "border-border/60"
                  )}
                  style={{
                    left: block.x,
                    top: block.y,
                    width: block.width,
                    height: INITIAL_BLOCK_HEIGHT,
                    backgroundColor: block.color
                  }}
                />
              ))}
            </div>

            {/* Current moving block */}
            {currentBlock && (
              <div
                className="absolute rounded-sm border-2 border-white/30 shadow-lg"
                style={{
                  left: currentBlock.x,
                  top: currentBlock.y,
                  width: currentBlock.width,
                  height: INITIAL_BLOCK_HEIGHT,
                  backgroundColor: currentBlock.color
                }}
              />
            )}

            {/* Drop hint */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/50 px-4 py-2 rounded-full flex items-center gap-2 text-sm">
              <MousePointerClick className="h-4 w-4" />
              <span>Tap to drop</span>
            </div>
          </div>
        );

      case 'gameover':
        const canContinue = continuesUsed < MAX_DIAMOND_CONTINUES && 
                          (currentUser?.diamond_points ?? 0) >= DIAMONDS_TO_CONTINUE;
        const score = Math.max(0, stackedBlocks.length - 1);

        return (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-primary/20 rounded-xl p-6 w-full max-w-md shadow-xl">
              <div className="text-center mb-6">
                <Award className="h-14 w-14 text-yellow-400 mx-auto mb-3" />
                <h2 className="text-3xl font-bold text-primary mb-2">Game Over!</h2>
                <p className="text-xl">
                  Score: <span className="font-bold">{score}</span>
                </p>
                <p className="text-muted-foreground mt-2">
                  Earned: {currentAttemptGold} <Coins className="inline h-4 w-4 text-yellow-400" /> 
                  {currentAttemptDiamonds > 0 && (
                    <span>, {currentAttemptDiamonds.toFixed(2)} <Gem className="inline h-4 w-4 text-sky-400" /></span>
                  )}
                </p>
              </div>

              <div className="space-y-3">
                {canContinue && (
                  <Button
                    onClick={continueWithDiamonds}
                    disabled={isApiLoading}
                    className="w-full h-12 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
                  >
                    {isApiLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Gem className="h-5 w-5 mr-2" />
                    )}
                    Continue ({DIAMONDS_TO_CONTINUE} 💎)
                  </Button>
                )}

                <Button
                  onClick={() => setGameState('idle')}
                  variant="outline"
                  className="w-full h-12 border-primary/30 hover:bg-primary/10"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Back to Menu
                </Button>
              </div>
            </div>
          </div>
        );

      case 'idle':
        return (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <div className="text-center max-w-md">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent mb-4">
                Sky-High Stacker
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Stack blocks perfectly to earn rewards and reach new heights!
              </p>

              <div className="space-y-4">
                <Button
                  onClick={startGame}
                  disabled={hearts <= 0 || isApiLoading}
                  className="w-full h-14 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white text-lg font-bold shadow-lg"
                >
                  {isApiLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <Play className="h-6 w-6 mr-2 fill-current" />
                  )}
                  {hearts <= 0 ? 'No Hearts Left' : 'Play (-1 Heart)'}
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={watchAdForHeart}
                    disabled={isAdInProgress || hearts >= MAX_POOLED_HEARTS}
                    variant="outline"
                    className="h-11 border-sky-500/50 hover:border-sky-500 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                  >
                    {isAdInProgress ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Tv className="h-4 w-4 mr-2" />
                    )}
                    Get Heart
                  </Button>

                  <Button
                    onClick={replenishHearts}
                    disabled={replenishTimeLeft !== 'Ready!'}
                    variant="secondary"
                    className="h-11 bg-slate-800 hover:bg-slate-700"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {replenishTimeLeft === 'Ready!' ? 'Replenish' : replenishTimeLeft || 'Wait'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Render auth error
  if (telegramAuthError || !currentUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {telegramAuthError ? "Authentication Error" : "Login Required"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {telegramAuthError || "Please launch the game through Telegram to play."}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-primary hover:bg-primary/90"
            >
              Reload App
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div 
        className="flex flex-col h-full" 
        style={{ height: 'calc(100vh - var(--header-height) - var(--bottom-nav-height))' }}
      >
        {/* Game header */}
        <div className="bg-slate-900/90 backdrop-blur-sm border-b border-primary/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
              <Heart
                key={`heart-${i}`}
                className={cn(
                  "h-5 w-5 transition-all",
                  i < hearts ? "text-red-500 fill-red-500" : "text-slate-600 fill-slate-700"
                )}
              />
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded">
              <Coins className="h-4 w-4 text-yellow-400" />
              <span className="font-medium">{currentAttemptGold}</span>
            </div>

            {currentAttemptDiamonds > 0 && (
              <div className="flex items-center space-x-1 bg-slate-800/80 px-2 py-1 rounded">
                <Gem className="h-4 w-4 text-sky-400" />
                <span className="font-medium">{currentAttemptDiamonds.toFixed(2)}</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <Award className="h-5 w-5 text-yellow-400" />
              <span className="font-medium">{highScore}</span>
            </div>
          </div>
        </div>

        {/* Game content */}
        <div ref={gameAreaRef} className="flex-1 relative">
          {renderGameContent()}
        </div>
      </div>
    </AppShell>
  );
}
