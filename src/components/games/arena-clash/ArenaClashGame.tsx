
'use client';

import React from 'react';
import { useArenaStore } from './store';
import CharacterSelectionScreen from './CharacterSelectionScreen';
import CombatArena from './CombatArena';
import LeaderboardDisplay from './LeaderboardDisplay';
import UpgradeSystemScreen from './UpgradeSystemScreen';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const ArenaClashGame: React.FC = () => {
  const gamePhase = useArenaStore(state => state.gamePhase);
  const isLoading = useArenaStore(state => state.isLoading);
  const setGamePhase = useArenaStore(state => state.setGamePhase);
  const player = useArenaStore(state => state.player);
  const opponent = useArenaStore(state => state.opponent);


  const renderGamePhase = () => {
    switch (gamePhase) {
      case 'character-selection':
        return <CharacterSelectionScreen />;
      case 'combat':
      case 'combat-player-turn':
      case 'combat-ai-turn':
      case 'combat-ability-animation':
        return <CombatArena />;
      case 'combat-result':
        return (
          <div className="text-center p-8 bg-card text-card-foreground rounded-lg shadow-xl max-w-md mx-auto">
            <h2 className="text-3xl font-bold mb-4 font-headline">
              {player.selectedCharacter?.isDefeated ? "You Lost!" : opponent?.isDefeated ? "You Won!" : "Match Over!"}
            </h2>
            <p className="mb-2">Player Health: {player.selectedCharacter?.stats.health} / {player.selectedCharacter?.stats.maxHealth}</p>
            <p className="mb-6">Opponent Health: {opponent?.stats.health} / {opponent?.stats.maxHealth}</p>
            <div className="space-y-3">
              <Button onClick={() => setGamePhase('character-selection')} className="w-full">Play Again</Button>
              <Button onClick={() => setGamePhase('upgrade-system')} variant="outline" className="w-full">Upgrade Character</Button>
              <Button onClick={() => setGamePhase('leaderboard')} variant="secondary" className="w-full">View Leaderboard</Button>
            </div>
          </div>
        );
      case 'upgrade-system':
        return <UpgradeSystemScreen />;
      case 'leaderboard':
        return <LeaderboardDisplay />;
      default:
        return <p>Unknown game phase: {gamePhase}</p>;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-2 sm:p-4 text-foreground relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-50">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}
      {renderGamePhase()}
    </div>
  );
};

export default ArenaClashGame;
