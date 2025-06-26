'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppShell } from "@/components/layout/AppShell";
import { Button } from '@/components/ui/button';
import { Heart, Play, Tv, Coins, Gem, Loader2, Award, RefreshCw, Clock, MousePointerClick, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useAdsgram } from '@/hooks/useAdsgram';

// --- Game Constants ---
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
const BLOCK_COLORS = ['hsl(var(--chart-1)/0.9)', 'hsl(var(--chart-2)/0.9)', 'hsl(var(--chart-3)/0.9)','hsl(var(--chart-4)/0.9)', 'hsl(var(--chart-5)/0.9)'];
const SPEED_START = 2.0;
const SPEED_INCREMENT = 0.05;
const MAX_SPEED = 7.0;
const PERFECT_DROP_THRESHOLD = 2.5;
const THREE_HOURS_IN_MS = 3 * 60 * 60 * 1000;
const ADSGRAM_STAKE_HEART_BLOCK_ID = process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID_STAKE_HEART || 'default-stake-heart-block-id';
const LOCAL_STORAGE_REPLENISH_KEY = 'hustleSoulHeartReplenish';

interface StackedBlock {
  id: string; x: number; y: number; width: number; color: string; isPerfect?: boolean;
}

export default function GamePage() {
  const { currentUser, loadingUser, telegramAuthError, updateUserSession, fetchUserData } = useUser();
  const { toast } = useToast();

  const [gameState, setGameState] = useState<'loading_user_data' | 'idle' | 'initializing_game' | 'playing' | 'dropping' | 'gameover'>('loading_user_data');
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isGameAreaReady, setIsGameAreaReady] = useState(false);
  
  // Game attempt state
  const [currentAttemptGold, setCurrentAttemptGold] = useState(0);
  const [currentAttemptDiamonds, setCurrentAttemptDiamonds] = useState(0);
  const [consecutivePerfects, setConsecutivePerfects] = useState(0);
  const [continuesUsed, setContinuesUsed] = useState(0);

  // User persistent state
  const [highScore, setHighScore] = useState(0);
  const [hearts, setHearts] = useState(0);
  const [replenishTimeLeft, setReplenishTimeLeft] = useState('');

  // Game mechanics state
  const [stackedBlocks, setStackedBlocks] = useState<StackedBlock[]>([]);
  const [currentBlock, setCurrentBlock] = useState<{ x: number; y: number; width: number; color: string; direction: 1 | -1; speed: number } | null>(null);
  const [stackOffsetY, setStackOffsetY] = useState(0);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const [gameAreaSize, setGameAreaSize] = useState({ width: 0, height: 0 });
  
  const parseHeartCount = useCallback((user: typeof currentUser | null) => {
    if (!user || !user.game_hearts) return 0;
    const heartsData = user.game_hearts[GAME_TYPE_IDENTIFIER];
    return typeof heartsData === 'number' ? Math.min(heartsData, MAX_POOLED_HEARTS) : 0;
  }, []);

  // Effect to set initial user data
  useEffect(() => {
    if (!loadingUser && currentUser?.id) {
      setHearts(parseHeartCount(currentUser));
      setHighScore(currentUser.stake_builder_high_score || 0);
      setGameState('idle');
    } else if (!loadingUser && !currentUser) {
      setGameState('idle');
    }
  }, [currentUser, loadingUser, parseHeartCount]);

  // Effect to measure game area & prevent race conditions
  useEffect(() => {
    const measureArea = () => {
      if (gameAreaRef.current) {
        const { clientWidth, clientHeight } = gameAreaRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setGameAreaSize({ width: clientWidth, height: clientHeight });
          setIsGameAreaReady(true);
        }
      }
    };

    const observer = new ResizeObserver(measureArea);
    const currentRef = gameAreaRef.current;
    if (currentRef) {
      observer.observe(currentRef);
      measureArea(); // Call immediately to get initial size
    }
    
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    }
  }, []);

  const processGameOver = useCallback(async () => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    setCurrentBlock(null);
    
    const finalScore = Math.max(0, stackedBlocks.length - 1);
    if (currentUser?.id && (finalScore > 0 || currentAttemptGold > 0 || currentAttemptDiamonds > 0)) {
      setIsApiLoading(true);
      try {
        const res = await fetch('/api/games/submit-score', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: currentUser.id, 
            gameType: GAME_TYPE_IDENTIFIER, 
            score: finalScore, 
            goldEarned: currentAttemptGold, 
            diamondEarned: currentAttemptDiamonds 
          }),
        });
        const data = await res.json();
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
          title: "Score Submission Failed", 
          variant: "destructive" 
        });
      } finally {
        setIsApiLoading(false);
      }
    }
    setGameState('gameover');
  }, [currentUser, stackedBlocks.length, currentAttemptGold, currentAttemptDiamonds, updateUserSession, toast]);

  const spawnNewBlock = useCallback((currentTopWidth: number, visualCurrentTopY: number) => {
    if (gameAreaSize.width === 0) return;
    
    const currentScore = Math.max(0, stackedBlocks.length - 1);
    const speed = Math.min(SPEED_START + (currentScore * SPEED_INCREMENT), MAX_SPEED);
    
    setCurrentBlock({
      x: Math.random() < 0.5 ? 0 : gameAreaSize.width - currentTopWidth,
      y: visualCurrentTopY - INITIAL_BLOCK_HEIGHT - 5,
      width: currentTopWidth, 
      color: BLOCK_COLORS[stackedBlocks.length % BLOCK_COLORS.length],
      direction: Math.random() < 0.5 ? 1 : -1, 
      speed
    });
  }, [gameAreaSize.width, stackedBlocks.length]);

  const initializeNewAttempt = useCallback(() => {
    if (!gameAreaRef.current) {
      setGameState('idle');
      toast({ 
        title: "Error", 
        description: "Game area disappeared. Please try again.", 
        variant: "destructive" 
      });
      return;
    }
    
    const { clientWidth, clientHeight } = gameAreaRef.current;
    
    setCurrentAttemptGold(0);
    setCurrentAttemptDiamonds(0);
    setConsecutivePerfects(0);
    setContinuesUsed(0);
    setStackOffsetY(0);

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
  }, [spawnNewBlock, toast]);

  const startGame = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ 
        title: "Authentication Required", 
        description: "Please login to play the game.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (hearts <= 0) {
      toast({ 
        title: "No Hearts Left!", 
        description: "Watch an ad or wait for replenishment.", 
        variant: "default" 
      });
      return;
    }
    
    if (isApiLoading || gameState !== 'idle') return;
    
    if (!isGameAreaReady || !gameAreaRef.current || gameAreaRef.current.clientWidth === 0) {
      toast({ 
        title: "Game is Initializing", 
        description: "Please wait a moment and try again.", 
        variant: "default" 
      });
      return;
    }

    setGameState('initializing_game');
    setIsApiLoading(true);
    
    try {
      const res = await fetch('/api/games/use-heart', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser.id, 
          gameType: GAME_TYPE_IDENTIFIER 
        }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        toast({ 
          title: 'Could Not Start', 
          description: data.error || 'Failed to start game', 
          variant: 'destructive' 
        });
        setGameState('idle');
        fetchUserData();
      } else {
        updateUserSession({ game_hearts: data.gameHearts });
        setHearts(data.remainingHearts);
        initializeNewAttempt();
      }
    } catch (error) {
      toast({ 
        title: 'Network Error', 
        description: 'Failed to connect to server', 
        variant: 'destructive' 
      });
      setGameState('idle');
    } finally {
      setIsApiLoading(false);
    }
  }, [
    currentUser?.id, 
    hearts, 
    isApiLoading, 
    gameState, 
    isGameAreaReady, 
    toast, 
    fetchUserData, 
    initializeNewAttempt, 
    updateUserSession
  ]);

  const continueAttempt = useCallback(() => {
    if (stackedBlocks.length > 0) {
      const topBlock = stackedBlocks[stackedBlocks.length - 1];
      spawnNewBlock(topBlock.width, topBlock.y - stackOffsetY);
      setGameState('playing');
    } else {
      initializeNewAttempt();
    }
  }, [stackedBlocks, spawnNewBlock, stackOffsetY, initializeNewAttempt]);

  const handleDropBlock = useCallback(() => {
    if (gameState !== 'playing' || !currentBlock) return;
    
    setGameState('dropping');
    
    const topStackBlock = stackedBlocks[stackedBlocks.length - 1];
    const overlapStart = Math.max(currentBlock.x, topStackBlock.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.width, topStackBlock.x + topStackBlock.width);
    const overlapWidth = Math.max(0, overlapEnd - overlapStart);

    if (overlapWidth < MIN_BLOCK_WIDTH) {
      processGameOver();
      return;
    }

    const xDiff = Math.abs(currentBlock.x - topStackBlock.x);
    const isPerfect = xDiff < PERFECT_DROP_THRESHOLD;
    let gainedGold = 0, gainedDiamonds = 0;
    
    if (isPerfect) {
      gainedGold = GOLD_PER_PERFECT_DROP;
      const newConsecutive = consecutivePerfects + 1;
      setConsecutivePerfects(newConsecutive);
      if (newConsecutive >= 3 && newConsecutive % 3 === 0) {
        gainedDiamonds = DIAMONDS_PER_3_PERFECTS;
        toast({ 
          description: (
            <span className="flex items-center">
              <Gem className="h-4 w-4 mr-1 text-sky-400" /> 
              3x Perfect! +{gainedDiamonds.toFixed(2)}💎
            </span>
          ), 
          duration: 1500 
        });
      }
    } else {
      gainedGold = GOLD_PER_DROP;
      setConsecutivePerfects(0);
    }

    setCurrentAttemptGold(s => s + gainedGold);
    setCurrentAttemptDiamonds(d => d + gainedDiamonds);

    const newBlockWidth = isPerfect ? topStackBlock.width : overlapWidth;
    const newBlockX = isPerfect ? topStackBlock.x : overlapStart;
    const newBlockY = topStackBlock.y - INITIAL_BLOCK_HEIGHT;
    const newBlock = { 
      id: `b-${Date.now()}`, 
      x: newBlockX, 
      y: newBlockY, 
      width: newBlockWidth, 
      color: currentBlock.color, 
      isPerfect 
    };
    
    setStackedBlocks(prev => [...prev, newBlock]);
    
    if (newBlock.y - stackOffsetY < gameAreaSize.height / 2.5) {
      setStackOffsetY(o => o + INITIAL_BLOCK_HEIGHT);
    }
    
    setTimeout(() => {
      if (gameLoopRef.current !== null) {
        spawnNewBlock(newBlockWidth, newBlockY - stackOffsetY);
        setGameState('playing');
      }
    }, 50);
  }, [
    gameState, 
    currentBlock, 
    stackedBlocks, 
    consecutivePerfects, 
    processGameOver, 
    spawnNewBlock, 
    stackOffsetY, 
    toast, 
    gameAreaSize.height
  ]);

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
      
      return { ...prev, x: newX, direction: newDirection as (1 | -1) };
    });
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, currentBlock, gameAreaSize.width]);

  useEffect(() => {
    if (gameState === 'playing' && currentBlock && !gameLoopRef.current) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
  }, [gameState, gameLoop, currentBlock]);

  const handleSpendDiamonds = async () => {
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
      const res = await fetch('/api/games/spend-diamonds-to-continue', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser.id, 
          diamondsToSpend: DIAMONDS_TO_CONTINUE 
        })
      });
      
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error || 'Failed to spend diamonds');
      
      updateUserSession({ diamond_points: data.newDiamondBalance });
      setContinuesUsed(c => c + 1);
      continueAttempt();
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

  const [isAdInProgress, setIsAdInProgress] = useState(false);
  
  const handleAdsgramRewardForHeart = useCallback(() => {
    toast({ 
      title: "Ad Watched!", 
      description: (
        <span className="flex items-center">
          <Heart className="h-4 w-4 mr-1 text-red-400 fill-red-400" /> 
          Heart reward processing...
        </span>
      ) 
    });
    setTimeout(() => { fetchUserData(); }, 3000); 
  }, [toast, fetchUserData]);

  const handleAdsgramClose = useCallback(() => {
    setIsAdInProgress(false);
  }, []);

  const showAdsgramAdForHeart = useAdsgram({
    blockId: ADSGRAM_STAKE_HEART_BLOCK_ID,
    onReward: handleAdsgramRewardForHeart,
    onError: handleAdsgramClose,
    onClose: handleAdsgramClose,
  });

  const watchAdForHeart = async () => {
    if (!currentUser || isAdInProgress || isApiLoading) return;
    
    if (hearts >= MAX_POOLED_HEARTS) {
      toast({ title: "Hearts Full" }); 
      return;
    }
    
    setIsAdInProgress(true);
    await showAdsgramAdForHeart();
  };

  const handleReplenishHearts = async () => {
    if (!currentUser?.id || isApiLoading) return;
    
    setIsApiLoading(true);
    
    try {
      const res = await fetch('/api/games/replenish-hearts', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ userId: currentUser.id }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: "Hearts Replenished!" });
        updateUserSession({ 
          game_hearts: data.hearts, 
          last_heart_replenished: data.nextReplenish 
        });
        setHearts(parseHeartCount({ ...currentUser, game_hearts: data.hearts }));
        localStorage.setItem(LOCAL_STORAGE_REPLENISH_KEY, data.nextReplenish);
      } else {
        toast({ 
          title: "Not Yet", 
          description: data.message || 'Cannot replenish hearts yet' 
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
  
  useEffect(() => {
    const lastReplenishIso = currentUser?.last_heart_replenished || localStorage.getItem(LOCAL_STORAGE_REPLENISH_KEY);
    
    if (!lastReplenishIso || gameState === 'playing' || hearts >= MAX_POOLED_HEARTS) {
      setReplenishTimeLeft('');
      return;
    }
    
    const intervalId = setInterval(() => {
      const nextReplenishTime = new Date(lastReplenishIso).getTime() + THREE_HOURS_IN_MS;
      const diff = nextReplenishTime - Date.now();
      
      if (diff <= 0) {
        setReplenishTimeLeft('Ready!');
        clearInterval(intervalId);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
        setReplenishTimeLeft(`${h}:${m}:${s}`);
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [currentUser?.last_heart_replenished, gameState, hearts]);

  const canContinue = continuesUsed < MAX_DIAMOND_CONTINUES && (currentUser?.diamond_points ?? 0) >= DIAMONDS_TO_CONTINUE;

  const renderGameContent = () => {
    if (gameState === 'loading_user_data' || !isGameAreaReady) {
      return (
        <div className="flex flex-grow items-center justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      );
    }
    
    if (gameState === 'playing' || gameState === 'dropping' || gameState === 'initializing_game') {
      return (
        <div 
          className="relative bg-black/40 border-2 border-primary/20 rounded-lg overflow-hidden shadow-2xl shadow-primary/30 w-full h-full" 
          onClick={handleDropBlock} 
          role="button" 
          aria-label="Drop Block"
        >
          {gameState === 'initializing_game' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          
          <div style={{ 
            transform: `translateY(${stackOffsetY}px)`, 
            transition: 'transform 0.3s ease-out' 
          }}>
            {stackedBlocks.map(b => (
              <div 
                key={b.id} 
                className={cn(
                  "absolute rounded-sm border", 
                  b.isPerfect && "ring-2 ring-yellow-300", 
                  b.id === 'base' ? 'border-muted/50' : 'border-border/60'
                )} 
                style={{ 
                  left: b.x, 
                  top: b.y, 
                  width: b.width, 
                  height: INITIAL_BLOCK_HEIGHT, 
                  background: b.color 
                }}
              />
            ))}
          </div>
          
          {currentBlock && (
            <div 
              className="absolute rounded-sm border border-white/40 shadow-lg" 
              style={{ 
                left: currentBlock.x, 
                top: currentBlock.y, 
                width: currentBlock.width, 
                height: INITIAL_BLOCK_HEIGHT, 
                background: currentBlock.color 
              }}
            />
          )}
        </div>
      );
    }

    if (gameState === 'gameover') {
      return (
        <div className="flex flex-col items-center justify-center text-center p-4 space-y-4 w-full animate-in fade-in-50">
          <div className="p-6 bg-card/80 rounded-lg shadow-xl border border-primary/30 w-full max-w-sm">
            <Award size={48} className="text-yellow-400 mb-2 mx-auto" />
            <h2 className="text-3xl font-bold font-headline">Game Over!</h2>
            <p className="text-lg mb-4">
              Score: <span className="font-bold text-primary">{stackedBlocks.length > 0 ? stackedBlocks.length - 1 : 0}</span>
            </p>
            
            {canContinue && (
              <Button 
                onClick={handleSpendDiamonds} 
                disabled={isApiLoading} 
                size="lg" 
                className="w-full mb-2 bg-sky-500 hover:bg-sky-600 text-white"
              >
                {isApiLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Gem className="mr-2 h-4 w-4" />
                )} 
                Continue (-{DIAMONDS_TO_CONTINUE}💎)
              </Button>
            )}
            
            <Button 
              onClick={() => setGameState('idle')} 
              variant="outline" 
              size="lg" 
              className="w-full"
            >
              {isApiLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Back to Menu
            </Button>
          </div>
        </div>
      );
    }
    
    if (gameState === 'idle') {
      return (
        <div className="flex flex-col items-center justify-center text-center p-4 space-y-4 max-w-sm w-full animate-in fade-in-50">
          <h1 className="text-4xl font-bold font-headline text-primary filter drop-shadow-[0_2px_4px_hsl(var(--primary)/0.5)]">
            Sky-High Stacker
          </h1>
          
          <p className="text-muted-foreground text-lg">
            Stack blocks perfectly to reach new heights!
          </p>
          
          <div className="w-full space-y-3 pt-4">
            <Button 
              onClick={startGame} 
              disabled={isApiLoading || hearts <= 0 || !isGameAreaReady} 
              size="lg" 
              className="w-full h-12 text-md font-bold animate-pulse-glow bg-gradient-to-r from-primary to-accent"
            >
              {isApiLoading || !isGameAreaReady ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Play className="mr-2 h-5 w-5 fill-current" />
              )}
              {isApiLoading ? 'Starting...' : !isGameAreaReady ? 'Initializing...' : 'Play (-1 Heart)'}
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={watchAdForHeart} 
                disabled={isApiLoading || isAdInProgress || hearts >= MAX_POOLED_HEARTS} 
                variant="outline" 
                className="h-11 border-sky-500/80 text-sky-400 hover:bg-sky-500/10 hover:text-sky-300"
              >
                {isAdInProgress ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Tv className="mr-2 h-4 w-4" />
                )} 
                Get <Heart className="inline h-4 w-4 mx-1 fill-current" />
              </Button>
              
              <Button 
                onClick={handleReplenishHearts} 
                disabled={isApiLoading || replenishTimeLeft !== 'Ready!'} 
                variant="secondary" 
                className="h-11"
              >
                <Clock className="mr-2 h-4 w-4" />
                {replenishTimeLeft && replenishTimeLeft !== 'Ready!' ? replenishTimeLeft : 'Replenish'}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };
  
  const renderContainer = () => {
    if (loadingUser) {
      return (
        <div className="flex flex-col items-center justify-center flex-grow p-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading Game...</p>
        </div>
      );
    }
    
    if (telegramAuthError || !currentUser) {
      return (
        <div className="flex flex-col items-center justify-center flex-grow p-4 text-center">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            {telegramAuthError ? "Authentication Error" : "Login Required"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {telegramAuthError || "Please launch the app via Telegram to play."}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Relaunch App
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col flex-grow items-center justify-between w-full bg-gradient-to-br from-slate-900 via-purple-950/80 to-slate-900 text-slate-100 p-2 overflow-hidden">
        {/* Game Header */}
        <div className="w-full px-2 sm:px-4 py-2 bg-slate-900/90 backdrop-blur-sm shadow-md border-b border-primary/30 z-20 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center space-x-1">
            {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
              <Heart 
                key={`life-${i}`} 
                className={cn(
                  "h-6 w-6 transition-all", 
                  i < hearts ? "text-red-500 fill-red-500" : "text-slate-600 fill-slate-700"
                )} 
              />
            ))}
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 p-1 px-2 bg-slate-700/60 rounded-md">
              <Coins className="text-yellow-400 h-4 w-4" /> 
              <span className="font-semibold tabular-nums">{currentAttemptGold}</span>
            </span>
            
            {currentAttemptDiamonds > 0 && (
              <span className="flex items-center gap-1 p-1 px-2 bg-slate-700/60 rounded-md">
                <Gem className="text-sky-400 h-4 w-4" /> 
                <span className="font-semibold tabular-nums">{currentAttemptDiamonds.toFixed(2)}</span>
              </span>
            )}
          </div>
          
          <p className="text-sm font-bold flex items-center gap-1.5">
            <Award className="h-5 w-5 text-yellow-400" />
            {highScore}
          </p>
        </div>

        {/* Game Content Area */}
        <div ref={gameAreaRef} className="flex flex-grow items-center justify-center w-full my-2">
          {renderGameContent()}
        </div>

        {/* Drop Instruction */}
        {(gameState === 'playing' || gameState === 'dropping') && (
          <div className="text-sm text-center text-foreground/80 py-1.5 flex items-center justify-center gap-1.5 z-20 bg-black/30 px-3 rounded-full absolute bottom-4 left-1/2 -translate-x-1/2">
            <MousePointerClick className="h-4 w-4" /> Tap or Press Space to Drop
          </div>
        )}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col" style={{ height: 'calc(100vh - var(--header-height, 64px) - var(--bottom-nav-height, 64px))'}}>
        {renderContainer()}
      </div>
    </AppShell>
  );
}
