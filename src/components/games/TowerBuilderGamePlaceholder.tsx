
'use client';
import { Layers, Coins, Gem } from "lucide-react";
import { GameCardWrapper } from "./GameCardWrapper";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

export function TowerBuilderGamePlaceholder() {
  const [gameActive, setGameActive] = useState(false);
  const [currentBlockPosition, setCurrentBlockPosition] = useState(50); // 0-100 for percentage
  const [towerHeight, setTowerHeight] = useState(0);
  const [perfectStacks, setPerfectStacks] = useState(0);
  const [gameMode, setGameMode] = useState<'fun' | 'rewards'>('fun');
  const [score, setScore] = useState(0); // Gold earned
  const { toast } = useToast();

  const handleStartGame = (mode: 'fun' | 'rewards') => {
    setGameActive(true);
    setTowerHeight(0);
    setPerfectStacks(0);
    setScore(0);
    setGameMode(mode);
    // TODO: Backend Integration - If mode is 'rewards', ensure heart was consumed (handled by GameCardWrapper)
    // Start block animation or game loop
    toast({ title: "Tower Builder Started!", description: `Mode: ${mode}. Stack the blocks!`});
  };

  const handlePlaceBlock = () => {
    if (!gameActive) return;

    // Simplified placement logic: 50 is perfect
    const isPerfect = Math.abs(currentBlockPosition - 50) < 5; // Example threshold for "perfect"

    if (isPerfect) {
      setTowerHeight(prev => prev + 1);
      setPerfectStacks(prev => prev + 1);
      if (gameMode === 'rewards') {
        const goldEarned = 5;
        setScore(prev => prev + goldEarned);
        toast({ title: "Perfect Stack!", description: `+${goldEarned} GOLD`, icon: <Coins className="h-5 w-5 text-yellow-500" /> });
        // TODO: Backend Integration - award 5 GOLD
        // console.log(`Award ${goldEarned} GOLD to user.`);

        if ((perfectStacks + 1) % 3 === 0) {
          const diamondEarned = 0.05;
          toast({ title: "Triple Perfect Streak!", description: `+${diamondEarned} DIAMOND`, icon: <Gem className="h-5 w-5 text-sky-500" /> });
          // TODO: Backend Integration - award 0.05 DIAMOND
          // console.log(`Award ${diamondEarned} DIAMOND to user.`);
        }
      }
    } else {
      // Not perfect, game over for this simple version
      toast({ title: "Tower Fell!", description: `Game Over. Final height: ${towerHeight}`, variant: "destructive" });
      setGameActive(false);
      // TODO: Backend Integration - Log game session (score, towerHeight)
      // console.log(`Game Over. Final score: ${score} GOLD, Height: ${towerHeight}`);
    }

    // Reset block for next placement or end game
    if (towerHeight > 10 && isPerfect) { // Arbitrary win condition for demo
        toast({ title: "Tower Complete!", description: `You built a magnificent tower! Final score: ${score} GOLD`, duration: 5000 });
        setGameActive(false);
    } else if (isPerfect) {
        setCurrentBlockPosition(Math.random() * 80 + 10); // New random position for next block
    }
  };

  // Simulate block moving - in a real game this would be an animation loop
  useState(() => {
    if (gameActive) {
      const interval = setInterval(() => {
        setCurrentBlockPosition(prev => {
          const next = prev + 5;
          return next > 95 ? 5 : next; // Simple back and forth
        });
      }, 200);
      return () => clearInterval(interval);
    }
  });


  return (
    <GameCardWrapper
      gameKey="towerBuilder"
      title="Tower Builder"
      description="Stack blocks perfectly to build the tallest tower. Earn GOLD for perfect stacks and DIAMONDS for streaks!"
      Icon={Layers}
      placeholderImageSrc="https://placehold.co/600x400.png?text=Tower+Builder+Game"
      imageAlt="Tower Builder Game Placeholder"
      imageAiHint="stacking blocks game"
      onStartGame={handleStartGame}
      gameActive={gameActive}
      setGameActive={setGameActive}
      currentScore={score}
      gameSpecificControls={
        <div className="flex flex-col items-center space-y-4 p-4">
          <div className="w-full h-10 bg-muted rounded relative overflow-hidden">
            <div 
              className="absolute top-0 h-full w-10 bg-primary rounded transition-all duration-100 ease-linear" 
              style={{ left: `${currentBlockPosition - 5}%` }} // Adjust for block width
            ></div>
          </div>
          <div className="h-20 w-32 bg-secondary rounded-b-lg relative mx-auto flex items-end justify-center">
            {/* Simple tower representation */}
            {Array.from({length: Math.min(towerHeight,5)}).map((_, i)=>(
                 <div key={i} className="h-4 w-full bg-primary/70 border-b border-background" style={{bottom: `${i*16}px`}}></div>
            ))}
             {towerHeight > 0 && <p className="text-xs text-primary-foreground absolute bottom-1">{towerHeight} Blocks</p>}
          </div>
          <Button onClick={handlePlaceBlock} disabled={!gameActive} className="w-full">
            Place Block
          </Button>
          <p className="text-sm text-muted-foreground">Score: {score} GOLD | Perfect Stacks: {perfectStacks}</p>
        </div>
      }
    >
      {/* Game content for modal */}
       <div className="text-center py-8">
            <h3 className="text-lg font-semibold mb-2">Build Your Tower!</h3>
            <div className="w-full h-10 bg-muted rounded relative overflow-hidden my-4">
                <div 
                className="absolute top-0 h-full w-10 bg-primary rounded transition-all duration-100 ease-linear" 
                style={{ left: `${currentBlockPosition - 5}%` }}
                ></div>
            </div>
            <div className="h-40 w-48 bg-card border border-border rounded-b-lg relative mx-auto flex flex-col-reverse items-center p-1 overflow-hidden">
                {Array.from({length: towerHeight}).map((_, i)=>(
                    <div key={i} className="h-3 w-[90%] bg-primary/80 mb-0.5 rounded-sm"></div>
                ))}
            </div>
            <p className="text-muted-foreground mt-2">Current Height: {towerHeight}</p>
            <Button onClick={handlePlaceBlock} disabled={!gameActive} className="w-full mt-4">
                Place Block
            </Button>
            {/* <p className="text-sm text-muted-foreground mt-2">Score: {score} GOLD | Perfect Stacks: {perfectStacks}</p> */}
            {/* Add more detailed game instructions or UI here */}
            <p className="text-xs text-muted-foreground mt-4">
                Stack blocks perfectly on top of each other.
                A perfect stack earns 5 GOLD. Three consecutive perfect stacks earn 0.05 DIAMOND.
            </p>
        </div>
    </GameCardWrapper>
  );
}
