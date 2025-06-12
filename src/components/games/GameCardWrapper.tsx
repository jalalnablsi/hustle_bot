
'use client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import React, { useState } from "react";
import Image from "next/image";
import { GameHeartDisplay } from "./GameHeartDisplay";
import { useGameHeartSystem } from "@/hooks/useGameHeartSystem";
import type { GameKey } from "@/app/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface GameCardWrapperProps {
  gameKey: GameKey;
  title: string;
  description: string;
  Icon: LucideIcon;
  placeholderImageSrc: string;
  imageAlt: string;
  imageAiHint: string;
  children?: React.ReactNode; // For specific game UI if needed inside the card or modal
  onStartGame: (mode: 'fun' | 'rewards') => void;
  gameActive: boolean;
  setGameActive: (active: boolean) => void;
  currentScore?: number;
  gameSpecificControls?: React.ReactNode;
}

export function GameCardWrapper({
  gameKey,
  title,
  description,
  Icon,
  placeholderImageSrc,
  imageAlt,
  imageAiHint,
  children,
  onStartGame,
  gameActive,
  setGameActive,
  currentScore,
  gameSpecificControls,
}: GameCardWrapperProps) {
  const { hearts, consumeHeart, addHeartFromAd, nextHeartIn, isInitialized } = useGameHeartSystem(gameKey);
  const [isPlayForFunMode, setIsPlayForFunMode] = useState(true);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const { toast } = useToast();

  const handleStartAttempt = () => {
    if (!isInitialized) {
        toast({ title: "Initializing...", description: "Please wait a moment for game data to load.", variant: "default"});
        return;
    }
    if (isPlayForFunMode) {
      setGameActive(true);
      setIsGameModalOpen(true);
      onStartGame('fun');
    } else {
      if (consumeHeart()) {
        setGameActive(true);
        setIsGameModalOpen(true);
        onStartGame('rewards');
      } else {
        // Toast for no hearts is handled by consumeHeart hook
      }
    }
  };

  const handleWatchAd = () => {
    toast({ title: "Simulating Ad", description: "In a real app, an ad would play here.", duration: 3000 });
    // TODO: Integrate with actual ad SDK
    // After ad successfully watched:
    addHeartFromAd();
  };
  
  const closeGameModal = () => {
    setIsGameModalOpen(false);
    setGameActive(false); // Reset game active state when closing modal
  }

  return (
    <Card className="shadow-lg hover:shadow-primary/40 transition-shadow duration-300 flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <Icon className="h-8 w-8 text-primary flex-shrink-0" />
          <CardTitle className="font-headline text-xl text-foreground">{title}</CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground h-12 overflow-hidden">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center">
        <div className="w-full aspect-video bg-muted rounded-md mb-4 overflow-hidden relative">
          <Image src={placeholderImageSrc} alt={imageAlt} layout="fill" objectFit="cover" data-ai-hint={imageAiHint} />
        </div>
        <GameHeartDisplay
          currentHearts={hearts}
          onWatchAd={handleWatchAd}
          canWatchAd={hearts < 3}
          nextHeartIn={nextHeartIn}
          isPlayForFunMode={isPlayForFunMode}
        />
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id={`fun-mode-switch-${gameKey}`}
            checked={isPlayForFunMode}
            onCheckedChange={setIsPlayForFunMode}
            disabled={gameActive || !isInitialized}
          />
          <Label htmlFor={`fun-mode-switch-${gameKey}`} className="text-sm text-muted-foreground">
            {isPlayForFunMode ? "Play for Fun" : "Play for Rewards"}
          </Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleStartAttempt} className="w-full" size="lg" disabled={gameActive || !isInitialized || (!isPlayForFunMode && hearts === 0)}>
          {gameActive ? "Game in Progress" : "Play Game"}
        </Button>
      </CardFooter>

      <Dialog open={isGameModalOpen} onOpenChange={(open) => {if (!open) closeGameModal(); else setIsGameModalOpen(true);}}>
        <DialogContent className="max-w-md w-[90vw] p-0" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="font-headline flex items-center gap-2">
              <Icon className="h-6 w-6 text-primary" /> {title}
            </DialogTitle>
            <DialogDescription>
              {isPlayForFunMode ? "Playing for fun!" : `Playing for rewards! Hearts: ${hearts}`}
              {currentScore !== undefined && ` | Score: ${currentScore}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {/* This is where the actual game UI / placeholder content will go */}
            {children ? children : (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Game simulation for {title}.</p>
                    <Image src={placeholderImageSrc} alt={imageAlt} width={300} height={150} data-ai-hint={imageAiHint} className="mx-auto my-4 rounded-md" />
                </div>
            )}
             {gameSpecificControls}
          </div>

          <DialogFooter className="p-4 border-t">
            <Button onClick={closeGameModal} variant="outline">
              End Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
