
'use client';

import React from 'react';
import { useArenaStore } from './store';
import { CHARACTER_CLASSES, Character } from './types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Shield, Sword, Wand2, VenetianMask, Zap, Heart, ShieldHalf } from 'lucide-react';

const CharacterCard: React.FC<{ character: Character; onSelect: (character: Character) => void }> = ({ character, onSelect }) => {
  
  const getIconForClass = (charClass: Character['class']) => {
    switch(charClass) {
      case 'Warrior': return <Sword className="h-6 w-6 text-red-500" />;
      case 'Assassin': return <VenetianMask className="h-6 w-6 text-purple-500" />;
      case 'Mage': return <Wand2 className="h-6 w-6 text-blue-500" />;
      case 'Tank': return <Shield className="h-6 w-6 text-green-500" />;
      default: return <Zap className="h-6 w-6" />;
    }
  };

  return (
    <Card className="w-full sm:w-64 bg-card/80 hover:shadow-primary/30 transition-all duration-300 transform hover:scale-105">
      <CardHeader className="items-center">
        <div className="relative w-32 h-40 mb-3 rounded overflow-hidden border-2 border-primary/50">
           <Image src={character.spriteUrl} alt={character.name} layout="fill" objectFit="cover" data-ai-hint={`${character.class.toLowerCase()} character fantasy`} />
        </div>
        <CardTitle className="font-headline text-xl flex items-center gap-2">{getIconForClass(character.class)} {character.name}</CardTitle>
        <CardDescription className="text-sm">{character.class}</CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-center space-y-1">
        <p className="flex items-center justify-center gap-1"><Heart className="h-3 w-3 text-red-400" /> HP: {character.stats.maxHealth}</p>
        <p className="flex items-center justify-center gap-1"><Sword className="h-3 w-3 text-orange-400" /> ATK: {character.stats.attackPower}</p>
        <p className="flex items-center justify-center gap-1"><ShieldHalf className="h-3 w-3 text-blue-400" /> DEF: {character.stats.defense}</p>
        <div className="pt-2">
            <h4 className="font-semibold text-xs mb-1">Abilities:</h4>
            {character.abilities.slice(0,2).map(ability => (
                <p key={ability.id} className="text-muted-foreground text-[0.65rem] leading-tight" title={ability.description}>{ability.name}</p>
            ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onSelect(character)} className="w-full">Select {character.name}</Button>
      </CardFooter>
    </Card>
  );
};

const CharacterSelectionScreen: React.FC = () => {
  const selectCharacter = useArenaStore(state => state.selectCharacter);

  return (
    <div className="flex flex-col items-center p-4">
      <h1 className="text-4xl font-bold mb-3 font-headline text-primary animate-pulse-glow">Choose Your Champion</h1>
      <p className="text-lg text-muted-foreground mb-8">Select a character class to begin your arena journey.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CHARACTER_CLASSES.map(char => (
          <CharacterCard key={char.id} character={char} onSelect={selectCharacter} />
        ))}
      </div>
    </div>
  );
};

export default CharacterSelectionScreen;
