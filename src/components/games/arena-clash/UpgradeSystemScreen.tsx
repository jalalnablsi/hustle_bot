
'use client';

import React from 'react';
import { useArenaStore } from './store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpCircle, ChevronLeft, Coins } from 'lucide-react';

const UpgradeSystemScreen: React.FC = () => {
  const playerCharacter = useArenaStore(state => state.player.selectedCharacter);
  const setGamePhase = useArenaStore(state => state.setGamePhase);
  // const spendUpgradePoint = useArenaStore(state => state.spendUpgradePoint); // Action to be added in store

  if (!playerCharacter) {
    return (
      <div className="text-center p-8">
        <p>No character selected to upgrade.</p>
        <Button onClick={() => setGamePhase('character-selection')} className="mt-4">Select Character</Button>
      </div>
    );
  }
  
  // Mock upgrade options - In a real system, these would be dynamic
  const mockUpgradeOptions = [
    { id: 'health', name: 'Max Health', cost: 1, current: playerCharacter.stats.maxHealth },
    { id: 'attack', name: 'Attack Power', cost: 1, current: playerCharacter.stats.attackPower },
    { id: 'defense', name: 'Defense', cost: 1, current: playerCharacter.stats.defense },
  ];

  const handleUpgrade = (statId: string) => {
    // TODO: Implement actual upgrade logic in Zustand store
    // This would involve:
    // 1. Checking if player has enough upgradePoints.
    // 2. Deducting points.
    // 3. Increasing the specific stat for playerCharacter.
    // 4. Potentially saving this to a backend.
    // spendUpgradePoint(statId); 
    alert(`Simulated upgrade for ${statId}. Points remaining: ${playerCharacter.upgradePoints - 1}`);
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4">
      <Card className="shadow-xl bg-card/80">
        <CardHeader className="text-center">
          <ArrowUpCircle className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="font-headline text-3xl">Upgrade {playerCharacter.name}</CardTitle>
          <CardDescription>
            Spend your hard-earned points to enhance your champion's abilities.
            <br />
            Upgrade Points Available: <span className="font-bold text-yellow-400">{playerCharacter.upgradePoints} <Coins className="inline h-4 w-4"/></span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockUpgradeOptions.map(opt => (
            <Card key={opt.id} className="p-4 bg-muted/30">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-lg">{opt.name}</h4>
                  <p className="text-sm text-muted-foreground">Current: {opt.current}</p>
                </div>
                <Button 
                  onClick={() => handleUpgrade(opt.id)} 
                  disabled={playerCharacter.upgradePoints < opt.cost}
                  size="sm"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Upgrade ({opt.cost} <Coins className="inline h-3 w-3 ml-1"/>)
                </Button>
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-4">
            More complex upgrades for abilities and unique passives will be available soon!
          </p>
        </CardContent>
      </Card>
       <Button 
        onClick={() => setGamePhase('character-selection')} 
        variant="outline" 
        className="mt-6 w-full max-w-xs mx-auto flex items-center"
      >
        <ChevronLeft className="mr-2 h-4 w-4" /> Back to Game
      </Button>
    </div>
  );
};

export default UpgradeSystemScreen;
