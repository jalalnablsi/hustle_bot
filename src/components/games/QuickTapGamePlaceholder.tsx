
'use client';
import { Zap, Gauge, MousePointerSquare } from "lucide-react";
import { GameCardWrapper } from "./GameCardWrapper";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Difficulty = 'easy' | 'medium' | 'hard' | 'very_hard' | 'very_very_hard';
const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'very_hard', 'very_very_hard'];
const difficultySettings = {
  easy: { taps: 5, timeLimit: 10, gold: 10, diamond: 0 },
  medium: { taps: 10, timeLimit: 15, gold: 20, diamond: 0.01 },
  hard: { taps: 15, timeLimit: 15, gold: 35, diamond: 0.02 },
  very_hard: { taps: 20, timeLimit: 10, gold: 50, diamond: 0.05 },
  very_very_hard: { taps: 25, timeLimit: 10, gold: 75, diamond: 0.1 },
};

export function QuickTapGamePlaceholder() {
  const [gameActive, setGameActive] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
  const [tapsRemaining, setTapsRemaining] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [gameMode, setGameMode] = useState<'fun' | 'rewards'>('fun');
  const { toast } = useToast();
  const timerId = useRef<NodeJS.Timeout | null>(null);

  const handleStartGame = (mode: 'fun' | 'rewards') => {
    setGameActive(true);
    setGameMode(mode);
    const settings = difficultySettings[selectedDifficulty];
    setTapsRemaining(settings.taps);
    setTimeLeft(settings.timeLimit);
    setScore(0);
    // TODO: Backend Integration - If mode is 'rewards', ensure heart was consumed
    toast({ title: "Quick Tap Started!", description: `Difficulty: ${selectedDifficulty}. Tap fast!`});
  };

  // Timer countdown
  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerId.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (gameActive && timeLeft === 0 && tapsRemaining > 0) {
      // Time's up!
      toast({ title: "Time's Up!", description: `You didn't tap all targets. Score: ${score}`, variant: "destructive"});
      setGameActive(false);
      // TODO: Backend Integration - Log game session
    }
    return () => {
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [gameActive, timeLeft, tapsRemaining, score]);

  const handleTap = () => {
    if (!gameActive || timeLeft === 0 || tapsRemaining === 0) return;

    setTapsRemaining(prev => prev - 1);
    const newTapsRemaining = tapsRemaining - 1;

    if (newTapsRemaining === 0) {
      // All targets tapped
      if (timerId.current) clearTimeout(timerId.current); // Stop timer
      const settings = difficultySettings[selectedDifficulty];
      let finalScore = 0;
      if (gameMode === 'rewards') {
        finalScore = settings.gold;
        setScore(finalScore);
        toast({ title: "Level Cleared!", description: `You earned ${settings.gold} GOLD and ${settings.diamond.toFixed(2)} DIAMOND!`, icon: <Zap className="h-5 w-5 text-yellow-500"/>});
        // TODO: Backend Integration - Award Gold & Diamonds
        // console.log(`Award ${settings.gold} GOLD and ${settings.diamond} DIAMOND`);
      } else {
         toast({ title: "Level Cleared!", description: "Great job tapping!"});
      }
      setGameActive(false);
      // TODO: Backend Integration - Log game session
    }
  };

  return (
    <GameCardWrapper
      gameKey="quickTap"
      title="Quick Tap Challenge"
      description="Test your reflexes! Tap targets before time runs out. Higher difficulty means greater rewards. Use mouse/touch to play."
      Icon={Zap}
      placeholderImageSrc="https://placehold.co/600x400.png?text=Quick+Tap+Game"
      imageAlt="Quick Tap Game Placeholder"
      imageAiHint="reaction speed game"
      onStartGame={handleStartGame}
      gameActive={gameActive}
      setGameActive={setGameActive}
      currentScore={score}
      gameSpecificControls={
         <div className="flex flex-col items-center space-y-4 p-4">
            {!gameActive && (
                <div className="w-full">
                <label htmlFor="difficulty-select" className="text-sm font-medium text-muted-foreground mb-1 block">Select Difficulty:</label>
                <Select value={selectedDifficulty} onValueChange={(value: Difficulty) => setSelectedDifficulty(value)}>
                    <SelectTrigger id="difficulty-select">
                    <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                    {difficulties.map(diff => (
                        <SelectItem key={diff} value={diff}>{diff.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                </div>
            )}
        </div>
      }
    >
        {/* Game content for modal */}
        <div className="text-center py-4 flex flex-col items-center justify-center min-h-[50vh]">
            {!gameActive ? (
                <>
                    <MousePointerSquare className="h-12 w-12 text-primary mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Ready to Tap?</h3>
                    <div className="w-full max-w-xs mx-auto mb-4">
                        <label htmlFor="difficulty-modal-select" className="text-sm font-medium text-muted-foreground mb-1 block">Difficulty:</label>
                        <Select value={selectedDifficulty} onValueChange={(value: Difficulty) => setSelectedDifficulty(value)}>
                            <SelectTrigger id="difficulty-modal-select">
                            <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            {difficulties.map(diff => (
                                <SelectItem key={diff} value={diff}>{diff.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-xs text-muted-foreground px-4">
                        Rewards for {selectedDifficulty.replace('_', ' ')}: {difficultySettings[selectedDifficulty].gold} GOLD, {difficultySettings[selectedDifficulty].diamond.toFixed(2)} DIAMOND.
                        <br/>
                        Tap the large button when the game starts.
                    </p>
                </>
            ) : (
                <>
                    <h3 className="text-3xl font-bold text-primary mb-2">Time: {timeLeft}s</h3>
                    <p className="text-xl text-muted-foreground mb-6">Taps Remaining: {tapsRemaining}</p>
                    <Button 
                        onClick={handleTap} 
                        className="w-40 h-40 md:w-48 md:h-48 rounded-full text-3xl animate-pulse-glow mx-auto block shadow-2xl focus:ring-4 ring-primary/50"
                        aria-label="Tap Me!"
                    >
                        TAP!
                    </Button>
                </>
            )}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center px-4">
          This is a placeholder. In the real game, you would tap the main button area with your mouse or finger.
        </p>
    </GameCardWrapper>
  );
}
