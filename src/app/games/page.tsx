'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RAPIER, init } from '@dimforge/rapier3d-compat';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Play, Coins, Gem, Award, RefreshCw, Clock, AlertTriangle, Tv } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';

const GAME_TYPE_IDENTIFIER = 'stake-builder';
const MAX_POOLED_HEARTS = 5;
const DIAMONDS_TO_CONTINUE = 1;
const MAX_DIAMOND_CONTINUES = 5;
const HEART_REPLENISH_TIME = 3 * 60 * 60 * 1000; // 3 hours in ms

export default function GamePage() {
  const { currentUser, loadingUser: contextLoadingUser, updateUserSession, fetchUserData, telegramAuthError } = useUser();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  // Game state
  const {
    score,
    hearts,
    highScore,
    gold,
    diamonds,
    continuesUsed,
    lastReplenish,
    setGameData,
    addScore,
    addGold,
    addDiamonds,
    useHeart,
    useContinue,
    setLastReplenish,
    resetGame
  } = useStore();

  const [gameState, setGameState] = useState<'loading' | 'idle' | 'playing' | 'gameover'>('loading');
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [isAdInProgress, setIsAdInProgress] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate time until next heart replenish
  useEffect(() => {
    if (!lastReplenish || hearts >= MAX_POOLED_HEARTS) {
      setTimeLeft('');
      return;
    }

    const interval = setInterval(() => {
      const nextReplenish = new Date(lastReplenish).getTime() + HEART_REPLENISH_TIME;
      const diff = nextReplenish - Date.now();

      if (diff <= 0) {
        setTimeLeft('Ready!');
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastReplenish, hearts]);

  // Initialize user data
  useEffect(() => {
    if (!currentUser) return;

    setGameData({
      hearts: Math.min(currentUser.game_hearts?.[GAME_TYPE_IDENTIFIER] || 0, MAX_POOLED_HEARTS),
      highScore: currentUser.stake_builder_high_score || 0,
      lastReplenish: currentUser.last_heart_replenished || new Date().toISOString()
    });

    setGameState('idle');
  }, [currentUser, setGameData]);

  // Start game function
  const startGame = async () => {
    if (hearts <= 0 || isApiLoading) {
      toast({ title: "No Hearts Left", description: "Watch an ad or wait for replenishment" });
      return;
    }

    setIsApiLoading(true);
    
    try {
      const res = await fetch('/api/games/use-heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser?.id, 
          gameType: GAME_TYPE_IDENTIFIER 
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        updateUserSession({ game_hearts: data.gameHearts });
        useHeart();
        init3DGame();
      } else {
        toast({ title: "Failed to start", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", variant: "destructive" });
    } finally {
      setIsApiLoading(false);
    }
  };

  // 3D Game Initialization
  const init3DGame = async () => {
    if (!canvasRef.current) return;

    setGameState('playing');
    resetGame();
    
    // Initialize physics
    await init();
    const RAPIER = await import('@dimforge/rapier3d-compat');
    
    // Setup Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Physics world
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    const world = new RAPIER.World(gravity);
    
    // Create ground
    const groundSize = 10;
    const groundHeight = 0.1;
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(groundSize, groundHeight, groundSize),
      new THREE.MeshStandardMaterial({ color: 0x4b5563 })
    );
    ground.position.y = -groundHeight / 2;
    scene.add(ground);
    
    // Physics ground
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
      groundSize / 2,
      groundHeight / 2,
      groundSize / 2
    );
    world.createCollider(groundColliderDesc);
    
    // Game variables
    const blocks: THREE.Mesh[] = [];
    let currentBlock: THREE.Mesh | null = null;
    let blockSpeed = 0.05;
    let direction = 1;
    let perfectDrops = 0;
    
    // Create new block
    const createBlock = (width = 2, height = 0.5, depth = 2) => {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(
          Math.random() * 0.5 + 0.5,
          Math.random() * 0.5 + 0.5,
          Math.random() * 0.5 + 0.5
        ),
        roughness: 0.3,
        metalness: 0.1
      });
      
      const block = new THREE.Mesh(geometry, material);
      block.position.y = blocks.length * height;
      block.position.x = -4 * direction;
      scene.add(block);
      
      return block;
    };
    
    // First block
    currentBlock = createBlock();
    blocks.push(currentBlock);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update physics
      world.step();
      
      // Move current block
      if (currentBlock) {
        currentBlock.position.x += blockSpeed * direction;
        
        if (currentBlock.position.x > 4 || currentBlock.position.x < -4) {
          direction *= -1;
        }
      }
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle block drop
    const dropBlock = () => {
      if (!currentBlock || blocks.length < 1) return;
      
      const lastBlock = blocks[blocks.length - 1];
      const xDiff = Math.abs(currentBlock.position.x - lastBlock.position.x);
      const isPerfect = xDiff < 0.2;
      
      // Calculate overlap
      const newWidth = Math.min(
        lastBlock.scale.x - Math.abs(currentBlock.position.x - lastBlock.position.x),
        currentBlock.scale.x
      );
      
      // Check if game over
      if (newWidth < 0.3) {
        endGame();
        return;
      }
      
      // Update score and rewards
      addScore(1);
      
      if (isPerfect) {
        perfectDrops++;
        addGold(5);
        
        if (perfectDrops % 3 === 0) {
          addDiamonds(0.5);
          toast({
            description: `3x Perfect! +0.5💎`,
            duration: 1500
          });
        }
      } else {
        perfectDrops = 0;
        addGold(1);
      }
      
      // Create new block
      currentBlock = createBlock(newWidth, 0.5, 2);
      blocks.push(currentBlock);
      
      // Increase difficulty
      blockSpeed += 0.005;
    };
    
    // Event listeners
    const handleClick = () => dropBlock();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') dropBlock();
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    
    // Cleanup
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      renderer.dispose();
    };
  };
  
  // End game
  const endGame = async () => {
    setGameState('gameover');
    
    if (!currentUser?.id) return;
    
    setIsApiLoading(true);
    try {
      const res = await fetch('/api/games/submit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          gameType: GAME_TYPE_IDENTIFIER,
          score,
          goldEarned: gold,
          diamondEarned: diamonds
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        updateUserSession({
          gold_points: data.totalGold,
          diamond_points: data.totalDiamonds,
          ...(data.isHighScore && { stake_builder_high_score: score })
        });
        
        if (data.isHighScore) {
          toast({
            title: "New High Score!",
            description: `You reached ${score} points!`,
            icon: <Award className="h-5 w-5 text-yellow-400" />
          });
        }
      }
    } catch (error) {
      toast({ title: "Failed to submit score", variant: "destructive" });
    } finally {
      setIsApiLoading(false);
    }
  };
  
  // Continue game
  const continueGame = async () => {
    if (continuesUsed >= MAX_DIAMOND_CONTINUES) {
      toast({ title: "Max continues used", variant: "destructive" });
      return;
    }
    
    setIsApiLoading(true);
    try {
      const res = await fetch('/api/games/spend-diamonds-to-continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          diamondsToSpend: DIAMONDS_TO_CONTINUE
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        updateUserSession({ diamond_points: data.newDiamondBalance });
        useContinue();
        init3DGame();
      } else {
        toast({ title: "Failed to continue", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", variant: "destructive" });
    } finally {
      setIsApiLoading(false);
    }
  };
  
  // Watch ad for heart
  const watchAdForHeart = async () => {
    if (hearts >= MAX_POOLED_HEARTS) {
      toast({ title: "Hearts are full" });
      return;
    }
    
    setIsAdInProgress(true);
    try {
      // Simulate ad completion
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const res = await fetch('/api/games/watch-ad-for-heart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      
      const data = await res.json();
      
      if (data.success) {
        updateUserSession({ game_hearts: data.gameHearts });
        setGameData({ hearts: Math.min(data.remainingHearts, MAX_POOLED_HEARTS) });
        toast({ title: "Heart added!" });
      } else {
        toast({ title: "Failed to add heart", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", variant: "destructive" });
    } finally {
      setIsAdInProgress(false);
    }
  };
  
  // Replenish hearts
  const replenishHearts = async () => {
    setIsApiLoading(true);
    try {
      const res = await fetch('/api/games/replenish-hearts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id })
      });
      
      const data = await res.json();
      
      if (data.success) {
        updateUserSession({
          game_hearts: data.hearts,
          last_heart_replenished: data.nextReplenish
        });
        setGameData({ 
          hearts: Math.min(data.hearts[GAME_TYPE_IDENTIFIER] || 0, MAX_POOLED_HEARTS),
          lastReplenish: data.nextReplenish
        });
        toast({ title: "Hearts replenished!" });
      } else {
        toast({ title: "Cannot replenish yet", description: data.message });
      }
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsApiLoading(false);
    }
  };

  // Render auth error
  if (telegramAuthError || !currentUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-center max-w-md bg-slate-900/80 backdrop-blur-sm p-8 rounded-xl border border-slate-700">
            <AlertTriangle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              {telegramAuthError ? "Authentication Error" : "Login Required"}
            </h2>
            <p className="text-slate-300 mb-6">
              {telegramAuthError || "Please launch through Telegram to play"}
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
        ref={gameContainerRef}
        className="relative w-full h-full overflow-hidden bg-gradient-to-br from-slate-900 to-gray-950"
      >
        {/* Game canvas */}
        <canvas 
          ref={canvasRef} 
          className={cn(
            "absolute inset-0 w-full h-full transition-opacity duration-500",
            gameState !== 'playing' ? 'opacity-0' : 'opacity-100'
          )}
        />
        
        {/* UI Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Score display */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <div className="flex items-center space-x-2 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700">
              {Array.from({ length: MAX_POOLED_HEARTS }).map((_, i) => (
                <Heart
                  key={i}
                  className={cn(
                    "h-5 w-5 transition-all",
                    i < hearts ? "text-rose-500 fill-rose-500" : "text-slate-600 fill-slate-700"
                  )}
                />
              ))}
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700">
                <Coins className="h-5 w-5 text-yellow-400" />
                <span className="font-bold text-white">{gold}</span>
              </div>
              
              <div className="flex items-center space-x-1 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700">
                <Gem className="h-5 w-5 text-sky-400" />
                <span className="font-bold text-white">{diamonds.toFixed(1)}</span>
              </div>
              
              <div className="flex items-center space-x-1 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-700">
                <Award className="h-5 w-5 text-yellow-400" />
                <span className="font-bold text-white">{score}</span>
              </div>
            </div>
          </div>
          
          {/* Drop hint */}
          {gameState === 'playing' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 pointer-events-auto"
            >
              <p className="text-sm font-medium text-white flex items-center">
                <span className="mr-2">Tap to drop</span>
                <span className="inline-block animate-bounce">👇</span>
              </p>
            </motion.div>
          )}
        </div>
        
        {/* Game menus */}
        <AnimatePresence>
          {gameState === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center p-4"
            >
              <div className="bg-slate-900/90 backdrop-blur-lg rounded-xl border border-slate-700 p-8 max-w-md w-full shadow-2xl">
                <motion.h1
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent"
                >
                  Tower Stack
                </motion.h1>
                
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  <Button
                    onClick={startGame}
                    disabled={hearts <= 0 || isApiLoading}
                    size="lg"
                    className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-lg shadow-lg"
                  >
                    {isApiLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    ) : (
                      <Play className="h-6 w-6 mr-2 fill-current" />
                    )}
                    {hearts <= 0 ? 'No Hearts Left' : 'Start Game'}
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={watchAdForHeart}
                      disabled={isAdInProgress || hearts >= MAX_POOLED_HEARTS}
                      variant="outline"
                      size="sm"
                      className="h-11 border-emerald-500/50 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
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
                      disabled={timeLeft !== 'Ready!' || isApiLoading}
                      variant="outline"
                      size="sm"
                      className="h-11 border-amber-500/50 hover:border-amber-500 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      {timeLeft || 'Replenish'}
                    </Button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
          
          {gameState === 'gameover' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            >
              <div className="bg-slate-900/90 backdrop-blur-lg rounded-xl border border-slate-700 p-8 max-w-md w-full shadow-2xl">
                <div className="text-center mb-6">
                  <Award className="h-14 w-14 text-yellow-400 mx-auto mb-3" />
                  <h2 className="text-3xl font-bold text-white mb-2">Game Over!</h2>
                  <p className="text-xl text-slate-300">
                    Score: <span className="font-bold text-white">{score}</span>
                  </p>
                  <p className="text-slate-400 mt-2">
                    High Score: <span className="font-medium text-yellow-400">{highScore}</span>
                  </p>
                </div>
                
                <div className="space-y-3">
                  {(continuesUsed < MAX_DIAMOND_CONTINUES) && (
                    <Button
                      onClick={continueGame}
                      disabled={isApiLoading}
                      size="lg"
                      className="w-full h-14 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold"
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
                    size="lg"
                    className="w-full h-14 border-slate-600 hover:bg-slate-800/50 hover:border-slate-500 text-white"
                  >
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Main Menu
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
