
export type CharacterClassType = "Warrior" | "Assassin" | "Mage" | "Tank";

export interface Ability {
  id: string;
  name: string;
  description: string;
  damage?: number; // Base damage if applicable
  heal?: number; // Base heal if applicable
  effect?: string; // e.g., "stun", "bleed", "shield"
  cooldown: number; // Turns
  currentCooldown?: number;
  manaCost?: number;
  animationKey?: string; // For attack/ability animation
  icon: string; // Icon name (e.g., from lucide-react or custom)
}

export interface CharacterStats {
  maxHealth: number;
  health: number;
  attackPower: number;
  defense: number;
  speed: number; // Determines turn order
  maxMana?: number;
  mana?: number;
}

export interface Character {
  id: string;
  name: string;
  class: CharacterClassType;
  stats: CharacterStats;
  abilities: Ability[];
  level: number;
  experience: number;
  upgradePoints: number;
  spriteUrl: string; // URL or path to character image/sprite
  isPlayer: boolean; // True if this character is controlled by the human player
  isDefeated: boolean;
  activeEffects?: { effect: string, duration: number }[]; // e.g., { effect: "stun", duration: 1 }
}

export interface Player {
  id: string; // Could be user ID from auth system
  name: string;
  selectedCharacter: Character | null;
  // Potentially Web3 wallet address if integrated
  // walletAddress?: string; 
}

export type GamePhase = 
  | "character-selection"
  | "matchmaking" // Placeholder
  | "combat"
  | "combat-player-turn"
  | "combat-ai-turn"
  | "combat-ability-animation"
  | "combat-result" // Win/Loss screen for the round/match
  | "upgrade-system"
  | "leaderboard";

export interface CombatLogEntry {
  id: string;
  turn: number;
  message: string;
  type: 'damage' | 'heal' | 'effect' | 'info' | 'critical' | 'miss';
}

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  wins: number;
  losses: number;
  rating: number; // Elo or similar
}

// Example for Zustand store state
export interface ArenaState {
  gamePhase: GamePhase;
  player: Player;
  opponent: Character | null; // Could be AI or another player
  
  turn: number;
  isPlayerTurn: boolean;
  
  selectedAbility: Ability | null;
  targetCharacterId: string | null; // For targeting abilities

  combatLog: CombatLogEntry[];
  leaderboard: LeaderboardEntry[]; // Mock data for now

  isLoading: boolean;
  errorMessage: string | null;

  // Actions - these will be methods in the Zustand store
  setGamePhase: (phase: GamePhase) => void;
  selectCharacter: (character: Character) => void;
  startCombat: (playerCharacter: Character, opponentCharacter: Character) => void;
  
  // Combat Actions
  performPlayerAbility: (ability: Ability, target: Character) => void;
  processAiTurn: () => void;
  applyDamage: (targetId: string, amount: number) => void;
  applyHeal: (targetId: string, amount: number) => void;
  endTurn: () => void;
  
  openUpgradeSystem: () => void;
  // ... other actions for upgrades, matchmaking, etc.
}

export const CHARACTER_CLASSES: Character[] = [
  {
    id: "warrior-01", name: "Valerius", class: "Warrior",
    stats: { maxHealth: 120, health: 120, attackPower: 15, defense: 10, speed: 5 },
    abilities: [
      { id: "w_slash", name: "Slash", description: "A basic sword attack.", damage: 15, cooldown: 0, icon: "Sword" },
      { id: "w_shield_bash", name: "Shield Bash", description: "Deals damage and may stun.", damage: 10, effect: "stun", cooldown: 3, icon: "Shield" },
    ],
    level: 1, experience: 0, upgradePoints: 0, spriteUrl: "https://placehold.co/150x200/ff6347/ffffff.png?text=Warrior", isPlayer: false, isDefeated: false
  },
  {
    id: "assassin-01", name: "Lyra", class: "Assassin",
    stats: { maxHealth: 80, health: 80, attackPower: 20, defense: 5, speed: 10 },
    abilities: [
      { id: "a_quick_strike", name: "Quick Strike", description: "A fast attack.", damage: 20, cooldown: 0, icon: "Dagger" },
      { id: "a_vanish", name: "Vanish", description: "Become harder to hit for 1 turn.", effect: "evasion_buff", cooldown: 4, icon: "EyeOff" },
    ],
    level: 1, experience: 0, upgradePoints: 0, spriteUrl: "https://placehold.co/150x200/40e0d0/ffffff.png?text=Assassin", isPlayer: false, isDefeated: false
  },
  {
    id: "mage-01", name: "Elara", class: "Mage",
    stats: { maxHealth: 70, health: 70, attackPower: 5, defense: 3, speed: 7, maxMana: 100, mana: 100 },
    abilities: [
      { id: "m_fireball", name: "Fireball", description: "Hurls a ball of fire.", damage: 25, manaCost: 20, cooldown: 0, icon: "Flame" },
      { id: "m_ice_nova", name: "Ice Nova", description: "Damages and may slow the enemy.", damage: 15, effect: "speed_debuff", manaCost: 30, cooldown: 3, icon: "Snowflake" },
    ],
    level: 1, experience: 0, upgradePoints: 0, spriteUrl: "https://placehold.co/150x200/8a2be2/ffffff.png?text=Mage", isPlayer: false, isDefeated: false
  },
  {
    id: "tank-01", name: "Gronk", class: "Tank",
    stats: { maxHealth: 150, health: 150, attackPower: 10, defense: 15, speed: 3 },
    abilities: [
      { id: "t_smash", name: "Smash", description: "A heavy, basic attack.", damage: 10, cooldown: 0, icon: "Hammer" },
      { id: "t_fortify", name: "Fortify", description: "Increases defense for 2 turns.", effect: "defense_buff", cooldown: 4, icon: "ShieldCheck" },
    ],
    level: 1, experience: 0, upgradePoints: 0, spriteUrl: "https://placehold.co/150x200/a0522d/ffffff.png?text=Tank", isPlayer: false, isDefeated: false
  },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, playerName: "ArenaChampion", wins: 50, losses: 5, rating: 1800 },
  { rank: 2, playerName: "ShadowStriker", wins: 45, losses: 8, rating: 1750 },
  { rank: 3, playerName: "MysticMaster", wins: 40, losses: 10, rating: 1700 },
  { rank: 4, playerName: "IronWall", wins: 35, losses: 7, rating: 1680 },
  { rank: 5, playerName: "Player123", wins: 30, losses: 15, rating: 1600 },
];
