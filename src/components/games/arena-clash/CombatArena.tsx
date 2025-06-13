
'use client';

import React from 'react';
import { useArenaStore } from './store';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { Heart, Sword, Shield, Wand2, Zap, Target, Bot, User, MessageSquare } from 'lucide-react';
import type { Character, Ability } from './types';
import { ScrollArea } from '@/components/ui/scroll-area';

const CharacterDisplay: React.FC<{ character: Character | null, isPlayerSide: boolean }> = ({ character, isPlayerSide }) => {
  if (!character) return <div className="w-48 h-64 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">No Character</div>;

  const healthPercentage = character.stats.maxHealth > 0 ? (character.stats.health / character.stats.maxHealth) * 100 : 0;

  return (
    <Card className={`w-full sm:w-56 md:w-64 border-2 ${isPlayerSide ? 'border-blue-500' : 'border-red-500'} bg-card/70 shadow-xl relative`}>
      {character.isDefeated && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 rounded-md">
          <p className="text-destructive text-2xl font-bold">DEFEATED</p>
        </div>
      )}
      <CardHeader className="p-3 items-center">
        <div className="relative w-28 h-36 sm:w-32 sm:h-40 mb-2 rounded overflow-hidden border border-border">
          <Image src={character.spriteUrl} alt={character.name} layout="fill" objectFit="cover" data-ai-hint={`${character.class.toLowerCase()} fantasy character portrait`} />
        </div>
        <CardTitle className="text-lg font-headline flex items-center gap-1.5">
          {isPlayerSide ? <User className="h-5 w-5 text-blue-400"/> : <Bot className="h-5 w-5 text-red-400"/>}
          {character.name}
        </CardTitle>
        <CardDescription className="text-xs">{character.class} - Lvl {character.level}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div>
          <div className="flex justify-between items-center text-xs mb-0.5">
            <span className="text-muted-foreground">HP</span>
            <span>{character.stats.health} / {character.stats.maxHealth}</span>
          </div>
          <Progress value={healthPercentage} className="h-3" 
            indicatorClassName={healthPercentage > 50 ? 'bg-green-500' : healthPercentage > 20 ? 'bg-yellow-500' : 'bg-red-500'}/>
        </div>
        {character.stats.mana !== undefined && character.stats.maxMana !== undefined && (
          <div>
            <div className="flex justify-between items-center text-xs mb-0.5">
                <span className="text-muted-foreground">Mana</span>
                <span>{character.stats.mana} / {character.stats.maxMana}</span>
            </div>
            <Progress value={(character.stats.mana / character.stats.maxMana) * 100} className="h-3" indicatorClassName="bg-blue-500" />
          </div>
        )}
         <div className="grid grid-cols-3 gap-1 text-center text-xs pt-1">
            <div><Sword size={12} className="inline mr-0.5 text-orange-400"/> {character.stats.attackPower}</div>
            <div><Shield size={12} className="inline mr-0.5 text-sky-400"/> {character.stats.defense}</div>
            <div><Zap size={12} className="inline mr-0.5 text-yellow-400"/> {character.stats.speed}</div>
        </div>
      </CardContent>
    </Card>
  );
};

const AbilityButton: React.FC<{ ability: Ability; onClick: () => void; disabled: boolean }> = ({ ability, onClick, disabled }) => {
  // TODO: Fetch actual Lucide icons based on ability.icon string
  const Icon = ability.icon === "Sword" ? Sword : ability.icon === "Shield" ? Shield : ability.icon === "Flame" ? Wand2 : Zap;
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || (ability.currentCooldown && ability.currentCooldown > 0)}
      className="flex-1 flex-col h-auto p-2 text-xs hover:bg-primary/10"
      title={`${ability.description} (CD: ${ability.currentCooldown || 0}/${ability.cooldown}${ability.manaCost ? `, Mana: ${ability.manaCost}` : ''})`}
    >
      <Icon className="h-5 w-5 mb-0.5" />
      <span>{ability.name}</span>
      {ability.currentCooldown && ability.currentCooldown > 0 && <span className="text-[0.6rem]">CD: {ability.currentCooldown}</span>}
    </Button>
  );
};

const CombatArena: React.FC = () => {
  const playerCharacter = useArenaStore(state => state.player.selectedCharacter);
  const opponentCharacter = useArenaStore(state => state.opponent);
  const isPlayerTurn = useArenaStore(state => state.isPlayerTurn);
  const performPlayerAbility = useArenaStore(state => state.performPlayerAbility);
  const turn = useArenaStore(state => state.turn);
  const combatLog = useArenaStore(state => state.combatLog);

  if (!playerCharacter || !opponentCharacter) {
    return <p>Loading combatants...</p>;
  }

  const handleAbilityClick = (ability: Ability) => {
    // For now, player always targets opponent, opponent always targets player
    const target = playerCharacter.isPlayer ? opponentCharacter : playerCharacter;
    performPlayerAbility(ability, target);
  };
  
  const getLogEntryColor = (type: string) => {
    switch(type) {
        case 'damage': return 'text-red-400';
        case 'heal': return 'text-green-400';
        case 'effect': return 'text-purple-400';
        case 'info': return 'text-sky-300';
        case 'critical': return 'text-yellow-400 font-bold';
        case 'miss': return 'text-slate-400 italic';
        default: return 'text-muted-foreground';
    }
  }

  return (
    <div className="flex flex-col items-center p-2 sm:p-4 space-y-4 md:space-y-6">
      <h2 className="text-2xl font-bold font-headline text-center">
        Turn {turn} - {isPlayerTurn && !playerCharacter.isDefeated ? "Your Turn" : opponentCharacter.isDefeated ? "Victory!" : playerCharacter.isDefeated ? "Defeat!" : "Opponent's Turn"}
      </h2>

      {/* Combatants Display */}
      <div className="flex flex-col md:flex-row justify-around items-center md:items-start w-full gap-4 md:gap-8">
        <CharacterDisplay character={playerCharacter} isPlayerSide={true} />
        <div className="text-4xl font-bold text-destructive hidden md:flex items-center self-center h-full animate-pulse-glow">VS</div>
        <CharacterDisplay character={opponentCharacter} isPlayerSide={false} />
      </div>

      {/* Player Abilities (only if player's turn and not game over) */}
      {!playerCharacter.isDefeated && !opponentCharacter.isDefeated && isPlayerTurn && (
        <Card className="w-full max-w-lg mt-4 bg-card/80">
          <CardHeader className="p-3">
            <CardTitle className="text-md text-center font-headline">Choose Your Action</CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex flex-wrap justify-center gap-2">
            {playerCharacter.abilities.map(ability => (
              <AbilityButton
                key={ability.id}
                ability={ability}
                onClick={() => handleAbilityClick(ability)}
                disabled={!isPlayerTurn}
              />
            ))}
          </CardContent>
        </Card>
      )}
      {!playerCharacter.isDefeated && !opponentCharacter.isDefeated && !isPlayerTurn && (
         <p className="text-lg text-muted-foreground animate-pulse text-center">Opponent is thinking...</p>
      )}

      {/* Combat Log */}
      <Card className="w-full max-w-2xl mt-4 bg-card/80">
        <CardHeader className="p-3">
          <CardTitle className="text-md font-headline flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Combat Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-32 sm:h-40 w-full px-3 pb-3">
            {combatLog.slice().reverse().map(entry => (
              <p key={entry.id} className={`text-xs ${getLogEntryColor(entry.type)} mb-0.5`}>
                <span className="font-semibold mr-1">[T{entry.turn}]</span>{entry.message}
              </p>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default CombatArena;
