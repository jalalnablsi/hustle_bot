
'use client';
import { ArrowUpCircle, Shield, Gem } from "lucide-react";
import { GameCardWrapper } from "./GameCardWrapper";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

export function BallJumpGamePlaceholder() {
  const [gameActive, setGameActive] = useState(false);
  const [gameMode, setGameMode] = useState<'fun' | 'rewards'>('fun');
  const [altitude, setAltitude] = useState(0);
  const [collectedDiamonds, setCollectedDiamonds] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const { toast } = useToast();

  const handleStartGame = (mode: 'fun' | 'rewards') => {
    setGameActive(true);
    setGameMode(mode);
    setAltitude(0);
    setCollectedDiamonds(0);
    setHasShield(false);
    // TODO: Backend Integration - If mode is 'rewards', ensure heart was consumed
    toast({ title: "Ball Jump Started!", description: `Mode: ${mode}. Jump to new heights!`});
  };

  // Simulate game actions
  const handleJump = () => {
    if (!gameActive) return;
    const jumpHeight = Math.floor(Math.random() * 10) + 5; // Random jump height
    setAltitude(prev => prev + jumpHeight);

    // Simulate collecting a diamond
    if (Math.random() < 0.1 && gameMode === 'rewards') {
      setCollectedDiamonds(prev => prev + 1);
      toast({ title: "Diamond Collected!", icon: <Gem className="h-5 w-5 text-sky-400"/> });
      // TODO: Backend Integration - Award 1 Diamond (or whatever the value is)
      // console.log("Award 1 DIAMOND");
    }
     // Simulate hitting an obstacle
    if (altitude > 50 && Math.random() < 0.2) { // Higher chance of obstacle at higher altitudes
        if (hasShield) {
            setHasShield(false);
            toast({ title: "Shield Protected You!", description: "Keep going!", icon: <Shield className="h-5 w-5 text-blue-500" />});
        } else {
            toast({ title: "Hit an Obstacle!", description: `Game Over. Altitude: ${altitude}, Diamonds: ${collectedDiamonds}`, variant: "destructive" });
            setGameActive(false);
            // TODO: Backend Integration - Log game session
            // console.log(`Game Over. Altitude: ${altitude}, Diamonds: ${collectedDiamonds}`);
            return;
        }
    }

    // Simulate finding a shield
    if (Math.random() < 0.05 && !hasShield) {
        setHasShield(true);
        toast({ title: "Shield Acquired!", icon: <Shield className="h-5 w-5 text-blue-500" /> });
    }
  };


  return (
    <GameCardWrapper
      gameKey="ballJump"
      title="Sky Jumper"
      description="Jump higher and higher, avoid obstacles, and collect diamonds. Use power-ups to aid your ascent!"
      Icon={ArrowUpCircle}
      placeholderImageSrc="https://placehold.co/600x400.png?text=Ball+Jump+Game"
      imageAlt="Ball Jump Game Placeholder"
      imageAiHint="jumping ball platformer"
      onStartGame={handleStartGame}
      gameActive={gameActive}
      setGameActive={setGameActive}
      currentScore={altitude} // Using altitude as score for this example
      gameSpecificControls={
        <div className="flex flex-col items-center space-y-3 p-2">
            <Button onClick={handleJump} disabled={!gameActive} className="w-full">
                Jump
            </Button>
            {hasShield && <p className="text-xs text-blue-500 flex items-center"><Shield className="h-4 w-4 mr-1"/> Shield Active</p>}
        </div>
      }
    >
      {/* Game content for modal */}
        <div className="text-center py-4 relative min-h-[250px] bg-gradient-to-b from-sky-300 to-sky-500 rounded-md p-4">
            <div 
                className="absolute bg-red-500 rounded-full w-8 h-8 transition-all duration-300 ease-out"
                style={{ bottom: `${Math.min(85, (altitude/2))}%`, left: '45%'}} // Simple altitude viz
            >
                <div className="relative w-full h-full flex items-center justify-center">
                    {hasShield && <Shield className="h-5 w-5 text-white absolute" />}
                </div>
            </div>
             {/* Placeholder obstacles */}
            <div className="absolute bg-gray-600 h-2 w-12 rounded" style={{bottom: '30%', left: `${altitude % 2 === 0 ? '20%' : '60%'}`}}></div>
            <div className="absolute bg-gray-600 h-2 w-12 rounded" style={{bottom: '60%', left: `${altitude % 2 !== 0 ? '25%' : '55%'}`}}></div>
            
            <div className="absolute top-2 right-2 p-2 bg-black/30 rounded-md text-white text-sm">
                <p>Altitude: {altitude}m</p>
                {gameMode === 'rewards' && <p className="flex items-center gap-1"><Gem className="h-4 w-4"/> {collectedDiamonds}</p>}
            </div>

            <div className="absolute bottom-4 left-0 right-0 px-4">
                 <Button onClick={handleJump} disabled={!gameActive} className="w-full">
                    Jump
                </Button>
            </div>
             <p className="text-xs text-white/70 mt-2 absolute top-2 left-2">
                Collect <Gem className="inline h-3 w-3"/> and avoid obstacles. Use <Shield className="inline h-3 w-3"/>!
            </p>
        </div>
    </GameCardWrapper>
  );
}
