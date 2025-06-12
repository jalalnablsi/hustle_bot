
'use client';
import { Layers, Coins, Gem, MousePointerSquare } from "lucide-react";
import { GameCardWrapper } from "./GameCardWrapper";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BLOCK_HEIGHT_PX = 20;
const PERFECT_PLACEMENT_THRESHOLD_PERCENT = 5; // e.g., 5% tolerance for perfect placement
const MAX_TOWER_HEIGHT_FOR_VISUAL = 10; // Max blocks to show visually in placeholder

export function TowerBuilderGamePlaceholder() {
  const [gameActive, setGameActive] = useState(false);
  const [movingBlockPosition, setMovingBlockPosition] = useState(50); // 0-100 for percentage left
  const [towerBlocks, setTowerBlocks] = useState<{ position: number; width: number }[]>([]);
  const [perfectStacks, setPerfectStacks] = useState(0);
  const [gameMode, setGameMode] = useState<'fun' | 'rewards'>('fun');
  const [score, setScore] = useState(0); // Gold earned
  const { toast } = useToast();
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>();
  const lastPlacedBlockWidth = useRef(100); // Percentage width, starts full

  const handleStartGame = (mode: 'fun' | 'rewards') => {
    setGameActive(true);
    setTowerBlocks([]);
    setPerfectStacks(0);
    setScore(0);
    setGameMode(mode);
    lastPlacedBlockWidth.current = 100; // Reset width for new game
    setMovingBlockPosition(50); // Reset moving block
    // Start block animation
    let direction = 1;
    let speed = 1.5; // Controls speed of the block movement

    function animateBlock() {
      setMovingBlockPosition(prev => {
        let nextPos = prev + speed * direction;
        if (nextPos > 100 - lastPlacedBlockWidth.current / 2 || nextPos < lastPlacedBlockWidth.current / 2) {
          direction *= -1; // Reverse direction
          // Ensure it doesn't go out of bounds based on its own width centered
          nextPos = Math.max(lastPlacedBlockWidth.current / 2, Math.min(100 - lastPlacedBlockWidth.current / 2, nextPos));
        }
        return nextPos;
      });
      animationFrameId.current = requestAnimationFrame(animateBlock);
    }
    animateBlock();
    toast({ title: "Tower Builder Started!", description: `Mode: ${mode}. Tap to stack the blocks perfectly!`});
  };

  useEffect(() => {
    return () => { // Cleanup animation frame on component unmount or game end
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);


  const handlePlaceBlockByTap = () => {
    if (!gameActive) return;

    const currentTowerHeight = towerBlocks.length;
    const basePosition = currentTowerHeight > 0 ? towerBlocks[currentTowerHeight - 1].position : 50; // Center of the base block
    const placementAccuracy = Math.abs(movingBlockPosition - basePosition);
    
    // Calculate new width based on accuracy. Less accurate = smaller new block.
    const reductionFactor = Math.min(1, placementAccuracy / (lastPlacedBlockWidth.current / 2)); // How far off from center relative to half width
    let newBlockWidth = lastPlacedBlockWidth.current * (1 - reductionFactor * 0.5); // Reduce width more significantly if off
    newBlockWidth = Math.max(10, newBlockWidth); // Minimum block width

    const isPerfect = placementAccuracy < (lastPlacedBlockWidth.current * (PERFECT_PLACEMENT_THRESHOLD_PERCENT / 100));

    if (newBlockWidth < 10 || (currentTowerHeight > 0 && placementAccuracy > lastPlacedBlockWidth.current / 2 + newBlockWidth / 2) ) { // Game over if block misses significantly or becomes too small
        toast({ title: "Tower Fell!", description: `Game Over. Final height: ${currentTowerHeight}. Score: ${score} GOLD`, variant: "destructive", duration: 4000 });
        setGameActive(false);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        // TODO: Backend Integration - Log game session (score, currentTowerHeight)
        return;
    }
    
    const newBlock = { position: movingBlockPosition, width: newBlockWidth };
    setTowerBlocks(prev => [...prev, newBlock]);
    lastPlacedBlockWidth.current = newBlockWidth;


    if (isPerfect) {
      setPerfectStacks(prev => prev + 1);
      if (gameMode === 'rewards') {
        const goldEarned = 5;
        setScore(prev => prev + goldEarned);
        toast({ title: "Perfect Stack!", description: `+${goldEarned} GOLD`, icon: <Coins className="h-5 w-5 text-yellow-500" /> });
        // TODO: Backend Integration - award 5 GOLD

        if ((perfectStacks + 1) % 3 === 0) { // Check with updated perfectStacks
          const diamondEarned = 0.05;
          // Note: For actual Diamond transactions, use a library that handles decimal arithmetic precisely.
          toast({ title: "Triple Perfect Streak!", description: `+${diamondEarned.toFixed(2)} DIAMOND`, icon: <Gem className="h-5 w-5 text-sky-400" /> });
          // TODO: Backend Integration - award 0.05 DIAMOND
        }
      }
    } else {
        setPerfectStacks(0); // Reset perfect streak if not perfect
    }
    
    // Arbitrary win condition for demo
    if (currentTowerHeight + 1 >= 15) { 
        toast({ title: "Magnificent Tower!", description: `You built a 15 block tower! Final score: ${score} GOLD`, duration: 5000 });
        setGameActive(false);
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }
  };


  return (
    <GameCardWrapper
      gameKey="towerBuilder"
      title="Tower Stacker"
      description="Stack blocks precisely like the classic Nokia game! Tap to drop the moving block. Perfect stacks earn GOLD, streaks earn DIAMONDS."
      Icon={Layers}
      placeholderImageSrc="https://placehold.co/600x400.png?text=Tower+Stacker"
      imageAlt="Tower Stacker Game"
      imageAiHint="stacking blocks tower"
      onStartGame={handleStartGame}
      gameActive={gameActive}
      setGameActive={(active) => {
        setGameActive(active);
        if (!active && animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
        }
      }}
      currentScore={score}
    >
      {/* Game content for modal */}
       <div 
        className="flex flex-col items-center justify-end h-[60vh] bg-gradient-to-t from-background to-muted/30 p-4 relative overflow-hidden" 
        ref={gameAreaRef}
        onClick={handlePlaceBlockByTap} // Main game interaction: tap the area
        role="button"
        tabIndex={0}
        aria-label="Game Area: Tap to place block"
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handlePlaceBlockByTap();}} // Space/Enter for accessibility
      >
        {/* Moving Block */}
        {gameActive && (
          <div 
            className="absolute h-5 bg-primary rounded shadow-lg transition-all duration-50 ease-linear" // Width is dynamic
            style={{ 
              left: `${movingBlockPosition - lastPlacedBlockWidth.current / 2}%`, 
              width: `${lastPlacedBlockWidth.current}%`,
              bottom: `${Math.min(towerBlocks.length, MAX_TOWER_HEIGHT_FOR_VISUAL) * BLOCK_HEIGHT_PX + BLOCK_HEIGHT_PX}px`, // Position above the current tower
            }}
          ></div>
        )}

        {/* Static Tower Blocks */}
        <div className="relative w-full flex flex-col-reverse items-center">
            {towerBlocks.slice(-MAX_TOWER_HEIGHT_FOR_VISUAL).map((block, index) => (
                <div 
                    key={index} 
                    className={cn("h-5 bg-secondary rounded-sm mb-px shadow-md")}
                    style={{ 
                        width: `${block.width}%`,
                        marginLeft: `${block.position - block.width/2 - (50 - block.width/2)}%` // Center based on its own width
                    }}
                ></div>
            ))}
        </div>
        
        {/* Base Platform */}
        <div className="h-5 w-[110%] bg-card border-t-2 border-border shadow-inner absolute bottom-0 left-[-5%] rounded-t-md"></div>
        
        <div className="absolute top-2 left-2 p-2 bg-black/50 rounded-md text-white text-xs">
          <p>Score: {score} GOLD</p>
          <p>Height: {towerBlocks.length}</p>
          <p>Perfects: {perfectStacks}</p>
        </div>

        {!gameActive && towerBlocks.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
            <MousePointerSquare className="h-12 w-12 text-primary mb-4" />
            <p className="text-xl font-semibold text-white">Tap Anywhere to Start Stacking!</p>
            <p className="text-sm text-gray-300">(Or press Space/Enter)</p>
          </div>
        )}
         {gameActive && (
             <p className="absolute bottom-10 text-center text-sm text-foreground/80 w-full px-4 animate-pulse">
                Tap to drop the block!
            </p>
         )}
      </div>
       <p className="text-xs text-muted-foreground mt-4 text-center px-4">
          This is a placeholder. In the real game, you would tap the screen to place the moving block.
          Aim for perfect stacks on top of each other!
        </p>
    </GameCardWrapper>
  );
}
