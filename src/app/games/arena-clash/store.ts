
'use client';

import { create } from 'zustand';
import type { ArenaState, Character, GamePhase, Ability, CombatLogEntry } from './types';
import { CHARACTER_CLASSES, MOCK_LEADERBOARD } from './types';

// Helper to create a deep copy of character to avoid direct state mutation issues
const deepCopyCharacter = (char: Character): Character => JSON.parse(JSON.stringify(char));

const initialState: Omit<ArenaState, 'setGamePhase' | 'selectCharacter' | 'startCombat' | 'performPlayerAbility' | 'processAiTurn' | 'applyDamage' | 'applyHeal' | 'endTurn' | 'openUpgradeSystem' > = {
  gamePhase: "character-selection",
  player: {
    id: "player1",
    name: "Player",
    selectedCharacter: null,
  },
  opponent: null,
  turn: 1,
  isPlayerTurn: true,
  selectedAbility: null,
  targetCharacterId: null,
  combatLog: [],
  leaderboard: MOCK_LEADERBOARD,
  isLoading: false,
  errorMessage: null,
};

export const useArenaStore = create<ArenaState>((set, get) => ({
  ...initialState,

  setGamePhase: (phase: GamePhase) => set({ gamePhase: phase, errorMessage: null }),

  selectCharacter: (characterData: Character) => {
    const playerCharacter = deepCopyCharacter(characterData);
    playerCharacter.isPlayer = true;
    // Find a different character for the opponent
    const opponentData = CHARACTER_CLASSES.find(c => c.id !== characterData.id) || CHARACTER_CLASSES[1];
    const opponentCharacter = deepCopyCharacter(opponentData);
    opponentCharacter.isPlayer = false;

    set({
      player: { ...get().player, selectedCharacter: playerCharacter },
      opponent: opponentCharacter,
      gamePhase: "combat",
      turn: 1,
      isPlayerTurn: playerCharacter.stats.speed >= opponentCharacter.stats.speed,
      combatLog: [{ id: Date.now().toString(), turn: 0, message: `Battle starts! ${playerCharacter.name} vs ${opponentCharacter.name}.`, type: 'info' }],
    });
  },

  startCombat: (playerCharacter: Character, opponentCharacter: Character) => {
    // This logic is mostly moved into selectCharacter for simplicity in this version
    // Can be expanded for matchmaking later
    set({
      player: { ...get().player, selectedCharacter: deepCopyCharacter(playerCharacter) },
      opponent: deepCopyCharacter(opponentCharacter),
      gamePhase: "combat",
      turn: 1,
      isPlayerTurn: playerCharacter.stats.speed >= opponentCharacter.stats.speed,
      combatLog: [{ id: Date.now().toString(), turn: 0, message: `Battle re-starts! ${playerCharacter.name} vs ${opponentCharacter.name}.`, type: 'info' }],
    });
  },

  addCombatLog: (message: string, type: CombatLogEntry['type']) => {
    set(state => ({
      combatLog: [...state.combatLog, { id: Date.now().toString(), turn: state.turn, message, type }]
    }));
  },
  
  applyDamage: (targetId: string, amount: number) => {
    set(state => {
      const { player, opponent, addCombatLog } = get();
      let newPlayerChar = player.selectedCharacter;
      let newOpponentChar = opponent;
      let targetName = "";

      if (player.selectedCharacter && player.selectedCharacter.id === targetId) {
        targetName = player.selectedCharacter.name;
        const newHealth = Math.max(0, player.selectedCharacter.stats.health - amount);
        newPlayerChar = { ...player.selectedCharacter, stats: { ...player.selectedCharacter.stats, health: newHealth }, isDefeated: newHealth === 0 };
        addCombatLog(`${targetName} takes ${amount} damage.`, 'damage');
        if (newHealth === 0) addCombatLog(`${targetName} has been defeated!`, 'info');
      } else if (opponent && opponent.id === targetId) {
        targetName = opponent.name;
        const newHealth = Math.max(0, opponent.stats.health - amount);
        newOpponentChar = { ...opponent, stats: { ...opponent.stats, health: newHealth }, isDefeated: newHealth === 0 };
        addCombatLog(`${targetName} takes ${amount} damage.`, 'damage');
         if (newHealth === 0) addCombatLog(`${targetName} has been defeated!`, 'info');
      }
      
      const gameEnded = (newPlayerChar && newPlayerChar.isDefeated) || (newOpponentChar && newOpponentChar.isDefeated);

      return {
        player: { ...player, selectedCharacter: newPlayerChar },
        opponent: newOpponentChar,
        gamePhase: gameEnded ? 'combat-result' : state.gamePhase,
      };
    });
  },

  applyHeal: (targetId: string, amount: number) => {
    // Similar to applyDamage, but for healing
    set(state => {
      const { player, opponent, addCombatLog } = get();
      let newPlayerChar = player.selectedCharacter;
      let newOpponentChar = opponent;

      if (player.selectedCharacter && player.selectedCharacter.id === targetId) {
        const newHealth = Math.min(player.selectedCharacter.stats.maxHealth, player.selectedCharacter.stats.health + amount);
        newPlayerChar = { ...player.selectedCharacter, stats: { ...player.selectedCharacter.stats, health: newHealth }};
        addCombatLog(`${player.selectedCharacter.name} heals for ${amount}.`, 'heal');
      } else if (opponent && opponent.id === targetId) {
        const newHealth = Math.min(opponent.stats.maxHealth, opponent.stats.health + amount);
        newOpponentChar = { ...opponent, stats: { ...opponent.stats, health: newHealth }};
        addCombatLog(`${opponent.name} heals for ${amount}.`, 'heal');
      }
      return { player: { ...player, selectedCharacter: newPlayerChar }, opponent: newOpponentChar };
    });
  },
  
  performPlayerAbility: (ability: Ability, target: Character) => {
    const { player, opponent, applyDamage, addCombatLog, endTurn } = get();
    if (!player.selectedCharacter || !opponent ) return;
    if (!get().isPlayerTurn) return;

    addCombatLog(`${player.selectedCharacter.name} uses ${ability.name} on ${target.name}!`, 'info');
    
    // TODO: Implement actual ability effects (damage, heal, status effects, cooldowns)
    if (ability.damage) {
      applyDamage(target.id, ability.damage + player.selectedCharacter.stats.attackPower);
    }
    // Handle mana costs, cooldowns
    // player.selectedCharacter.stats.mana -= ability.manaCost;
    // ability.currentCooldown = ability.cooldown;

    // After ability effect, check if game ended BEFORE ending turn
    if (get().gamePhase !== 'combat-result') {
        endTurn();
    }
  },

  processAiTurn: () => {
    set({isLoading: true });
    const { opponent, player, applyDamage, addCombatLog, endTurn } = get();
    if (!opponent || !player.selectedCharacter || opponent.isDefeated || player.selectedCharacter.isDefeated) {
      set({isLoading: false});
      return;
    }

    // Simple AI: use the first available ability
    // TODO: Make AI smarter
    setTimeout(() => { // Simulate AI thinking time
        const aiAbility = opponent.abilities[0];
        if (aiAbility) {
            addCombatLog(`${opponent.name} uses ${aiAbility.name} on ${player.selectedCharacter!.name}!`, 'info');
            if (aiAbility.damage) {
                applyDamage(player.selectedCharacter!.id, aiAbility.damage + opponent.stats.attackPower);
            }
        } else {
             addCombatLog(`${opponent.name} ponders...`, 'info'); // Fallback if no abilities
        }
        
        // After AI ability effect, check if game ended BEFORE ending turn
        if (get().gamePhase !== 'combat-result') {
             endTurn();
        }
        set({isLoading: false});
    }, 1000); // 1 second delay for AI turn
  },

  endTurn: () => {
    set(state => {
      const nextPlayerTurn = !state.isPlayerTurn;
      const newTurnNumber = nextPlayerTurn ? state.turn + 1 : state.turn;
      if (newTurnNumber > state.turn) {
        get().addCombatLog(`Turn ${newTurnNumber} begins.`, 'info');
      }
      return {
        isPlayerTurn: nextPlayerTurn,
        turn: newTurnNumber,
        selectedAbility: null,
        targetCharacterId: null,
      };
    });
    // Trigger AI turn if it's now AI's turn
    if (!get().isPlayerTurn && get().gamePhase === 'combat') {
      get().processAiTurn();
    }
  },

  openUpgradeSystem: () => {
    set({ gamePhase: 'upgrade-system' });
  },

}));

// Provider component for easy context wrapping
export const ArenaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return children; // Zustand store is globally available once created, no explicit provider needed like Jotai/Context API
};
